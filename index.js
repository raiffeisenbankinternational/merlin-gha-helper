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

// defines where to extract the artifact used for deployment
var extractPath = process.env.CDA_EXTRACT_PATH;

// expects build or deploy
// build triggers Raiffeisen Build Automation with Ansible support
// deploy triggers RBI Merlin's deployment scripts
async function runScript() {
    try {
        actiontype = core.getInput("action-type")
        core.debug(`action-type: ${actiontype}`);
        switch (actiontype.toLowerCase()) {
            case "build":
                toolName = await io.which('bash', true)
                args = [
                    'export PROJECTDIR=/mnt/data/rba/rba-build-automation ; ',
                    'source ${PROJECTDIR}/install/env.sh; ',
                    'source ${PROJECTDIR}/bin/common.sh; ',
                    'function prepare_gradle_template () { cp -r \"${PROJECTDIR}/templates/upload/\"\* \"${WORKSPACE}/\"; sed -i -e \"s/{productName}/${PRODUCT_NAME}/g\" \"${WORKSPACE}/build.gradle\"; sed -i -e \"s/{componentName}/${COMPONENT_NAME}/g\" \"${WORKSPACE}/settings.gradle\"; }; ',
                    'export -f prepare_gradle_template; ',
                    'source ${PROJECTDIR}/bin/build/ansible.sh; ',
                    'build',
                ].join(' ')
                await exec.exec(`${toolName} -c \"${args}\"`);
                await uploadBuildInfo();
                break;
            case "deploy":
                await downloadBuildInfo();
                await downloadAndExtract();
                await exec.exec(`deploy.sh`);
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