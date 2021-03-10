// RBI Merlin's Custom GitHub Action
// Author: Gabor Horvath <gabor1.horvath at rbinternational.com>

// GitHub Actions Toolkit
const core = require("@actions/core");
const exec = require("@actions/exec");
const artifact = require("@actions/artifact");
const io = require("@actions/io");

// for artifact upload and download function
const artifactName = 'buildInfo.json';
const files = [
    'build/cda/buildInfo.json'
]

const CDA_COMPONENT_ALIAS = "svc";
const CDA_BRIDGE_REQUEST_ID = process.env.GITHUB_RUN_ID;
const CDA_REQUEST_ID = CDA_BRIDGE_REQUEST_ID;
const CDA_EXTRACT_PATH = `${process.env.GITHUB_WORKSPACE}/${CDA_REQUEST_ID}`
const CDA_PRODUCT_RELEASE = process.env.MERLIN_RELEASE
const CDA_PRODUCT_NAME = process.env.MERLIN_PRODUCT_NAME
const CDA_COMPONENT_NAME = process.env.MERLIN_COMPONENT_NAME
const CDA_ENVIRONMENT = process.env.MERLIN_ENVIRONMENT
const CDA_COMPONENT_NEW_VERSION=`${CDA_PRODUCT_RELEASE}.b${process.env.MERLIN_BUILD_NUMBER}`
const ENVIRONMENT_ZONE_UPPER = process.env.MERLIN_ACCOUNT

// vars required for the build
const WORKSPACE = process.env.GITHUB_WORKSPACE

// defines where to extract the artifact used for deployment
const extractPath = CDA_EXTRACT_PATH;

// construct this weird CDA_PROPERTIES setting
function create_properties() {
    const make_prop = (k, v) => `export ${k}=${v}`

    return `${make_prop("CDA_COMPONENT_ALIAS", CDA_COMPONENT_ALIAS)}\n` +
           `${make_prop("CDA_BRIDGE_REQUEST_ID", CDA_BRIDGE_REQUEST_ID)}\n` +
           `${make_prop("CDA_REQUEST_ID", CDA_REQUEST_ID)}\n` +
           `${make_prop("CDA_EXTRACT_PATH", CDA_EXTRACT_PATH)}\n` +
           `${make_prop("CDA_PRODUCT_RELEASE", CDA_PRODUCT_RELEASE)}\n` +
           `${make_prop("CDA_PRODUCT_NAME", CDA_PRODUCT_NAME)}\n` +
           `${make_prop("CDA_COMPONENT_NAME", CDA_COMPONENT_NAME)}\n` +
           `${make_prop("CDA_ENVIRONMENT", CDA_ENVIRONMENT)}\n` +
           `${make_prop("CDA_COMPONENT_NEW_VERSION", CDA_COMPONENT_NEW_VERSION)}`;
}

// expects build or deploy
// build triggers Raiffeisen Build Automation with Ansible support
// deploy triggers RBI Merlin's deployment scripts
async function runScript() {
    try {
        actiontype = core.getInput("action-type")
        core.debug(`action-type: ${actiontype}`);
        switch (actiontype.toLowerCase()) {
            case "build":
                process.env.WORKSPACE = WORKSPACE;
                process.env.PRODUCT_NAME = CDA_PRODUCT_NAME;
                process.env.COMPONENT_NAME = CDA_COMPONENT_NAME;
                process.env.RELEASE = CDA_PRODUCT_RELEASE;
                process.env.BUILD_NUMBER = process.env.MERLIN_BUILD_NUMBER;
                process.env.VERSION = CDA_COMPONENT_NEW_VERSION;
                process.env.PROJECTDIR = '/mnt/data/rba/rba-build-automation';
                args = [
                    'source ${PROJECTDIR}/install/env.sh; ',
                    'source ${PROJECTDIR}/bin/common.sh; ',
                    'function prepare_gradle_template () { cp -r \"${PROJECTDIR}/templates/upload/\"\* \"${WORKSPACE}/\"; sed -i -e \"s/{productName}/${PRODUCT_NAME}/g\" \"${WORKSPACE}/build.gradle\"; sed -i -e \"s/{componentName}/${COMPONENT_NAME}/g\" \"${WORKSPACE}/settings.gradle\"; }; ',
                    'export -f prepare_gradle_template; ',
                    'source ${PROJECTDIR}/bin/build/ansible.sh; ',
                    'build',
                ].join(' ');
                toolName = await io.which('bash', true)
                await exec.exec(`${toolName} -c \"${args}\"`);
                await uploadBuildInfo();
                break;

            case "deploy":
                process.env.CDA_PROPERTIES = `${create_properties()}`;
                process.env.CDA_PRODUCT_NAME = CDA_PRODUCT_NAME;
                process.env.CDA_PRODUCT_RELEASE = CDA_PRODUCT_RELEASE;
                process.env.CDA_COMPONENT_NAME = CDA_COMPONENT_NAME;
                process.env.CDA_COMPONENT_NEW_VERSION = CDA_COMPONENT_NEW_VERSION;
                process.env.CDA_COMPONENT_ALIAS = CDA_COMPONENT_ALIAS;
                process.env.CDA_BRIDGE_REQUEST_ID = CDA_BRIDGE_REQUEST_ID;
                process.env.CDA_REQUEST_ID = CDA_REQUEST_ID;
                process.env.CDA_ENVIRONMENT = CDA_ENVIRONMENT;
                process.env.ENVIRONMENT_ZONE_UPPER = ENVIRONMENT_ZONE_UPPER;
                process.env.CDA_EXTRACT_PATH = CDA_EXTRACT_PATH;
                args = [
                    `cd ${CDA_EXTRACT_PATH}; `,
                    'deploy.sh'
                ].join(' ');
                toolName = await io.which('bash', true)
                await downloadBuildInfo();
                await downloadAndExtract();
                await exec.exec(`${toolName} -c \"${args}\"`);
                break;
            default:
                core.setFailed('Not supported action-type. Supported action-type values: "build" or "deploy".');
        }
    } catch (error) {
        core.debug(error);
        core.setFailed(error.message);
    }
}

// uploads buildInfo.json which contains metadata (URL to artifact in Nexus, build number) about the built artifact
// created by merlin-build-lib Ansible roles (e.g. build-docker) and used by RBI Merlin's deployment scripts
// used to pass information between build and deploy jobs
async function uploadBuildInfo() {
    try {
        const artifactUploadClient = artifact.create();
        const rootDirectory ='.'
        const options = {
            continueOnError: false
        }
        const uploadResponse = await artifactUploadClient.uploadArtifact(artifactName, files, rootDirectory, options)
    } catch (error) {
        core.setFailed(error.message);
    }
}
// downloads buildInfo.json which contains metadata (URL to artifact in Nexus, build number) about the built artifact
// used by RBI Merlin's deployment scripts
async function downloadBuildInfo() {
    await io.mkdirP(`${extractPath}`);
    try {
        const artifactDownloadClient = artifact.create();
        const options = {
            createArtifactFolder: false
        }
        const downloadResponse = await artifactDownloadClient.downloadArtifact(artifactName, extractPath, options)
        // debug information about artifactName and downloadPath
        for (prop in downloadResponse) {
            if (downloadResponse.hasOwnProperty(prop)) {
                core.debug(`${prop}: ${downloadResponse[prop]}`)
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

// reads artifactUrl from buildInfo.json
const getNexusUrlSync = () => {
    const fs = require('fs');
    const FILE_NAME = `${extractPath}/build/cda/buildInfo.json`;
    var dataJson = null;
    try {
        dataJson = JSON.parse(fs.readFileSync(FILE_NAME));
        var artifactUrl = dataJson[0].artifactUrl;
        core.debug(`artifactUrl: ${artifactUrl}`)
        core.debug(dataJson);
        return artifactUrl;
    } catch (error) {
        core.debug(error);
        core.setFailed(error.message);
    }
}

// parses and returns artifactBaseName
function getArtifactBaseName() {
    var url = require("url");
    var path = require("path");
    url1 = getNexusUrlSync();
    var parsed = url.parse(`${url1}`);
    core.debug(`parsed: ${parsed}`);
    var artifactBaseName = path.posix.basename(parsed.pathname);
    core.debug(`artifactBaseName: ${artifactBaseName}`);
    return artifactBaseName;
}

// downloads the artifact from Nexus and extracts to the $CDA_EXTRACT_PATH
async function downloadAndExtract() {
    try {
        core.addPath('/usr/bin')
        const baseName = getArtifactBaseName();
        const finalurl = getNexusUrlSync();
        await exec.exec(`curl --silent -o ${baseName} ${finalurl}`);
        await exec.exec(`tar -xvf ${baseName} -C ${extractPath}`);
        await exec.exec(`find . -name "*.sh" -exec chmod +x "{}" \;`);
        core.addPath(`${extractPath}`);
    } catch (error) {
        core.debug(error);
        core.setFailed(error.message);
    }
}

// main
runScript();
