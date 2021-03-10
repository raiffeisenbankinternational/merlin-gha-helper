# Merlin GitHub Actions Helper

This custom action calls Raiffeisen Build Automation (RBA) and/or Merlin deployment scripts. It is expected to run on self-hosted build servers where RBA is pre-installed and on deployment servers of Merlin PaaS accounts. 
This action is using [GitHub Actions Toolkit](https://github.com/actions/toolkit) which is a collection of Node.js packages. 

## Inputs

### `action-type`

**Required** Type of action. Allowed values: build or deploy

## Example usage

### For builds
```
- name: Run Raiffeisen Build Automation
  uses: raiffeisenbankinternational/merlin-gha-helper@v2.0.0
  with:
    action-type: 'build'
```

### For deployments
```
- name: Run Raiffeisen Build Automation
  uses: raiffeisenbankinternational/merlin-gha-helper@v2.0.0
  with:
    action-type: 'deploy'
```

## Build and Package the Action

Before you begin, you'll need to download Node.js and create a GitHub repository.

1. Download and installe Node.js 12.x, which includes npm.
2. Check out this repository from GitHub
3. Install the following npm modules
  * npm install @actions/core
  * npm install @actions/artifact
  * npm install @actions/exec
  * npm install @actions/io
4. Edit index.js and make your changes
5. Use [@vercel/ncc](https://github.com/vercel/ncc) to compile the code and modules into one file used for distribution.
  * ncc build index.js --license licenses.txt
6. Commit and push the changes you made in dist/index.js and dist/licenses.txt
7. Tag your changed version and push the new tag
  * git tag -a -m "New release" v2.0.0
  * git push --follow-tags


# Change Log

## v2.0.0

Merlin-internal terminology has been removed from merlin-gha-helper so that the workflow files
can be written much more concisely than with version v1.0.0.

The only parameters to be provided for the gha-helper are now passed using a few environment variables.

### Global settings

These variables should be set on a global level as they describe the component in general

| Variable Name         | Remark        | 
| --------------------- |---------------| 
| MERLIN_PRODUCT_NAME   | The product name                       |
| MERLIN_COMPONENT_NAME | The component name (should end in -svc), usually the name of the repo|
| MERLIN_RELEASE        | A release number, e.g. 1.0.0 |
| MERLIN_BUILD_NUMBER   | A build number. e.g. ${{git.run_number}} |


### Deployment setting

Those variables are only relevant for deploy steps and don't have to be set
on global scope.

Variables required only for the deploy type
| Variable Name         | Remark        | 
| --------------------- |---------------| 
| MERLIN_ACCOUNT        | The account name in uppercase letters the component is getting deployed to |
| MERLIN_ENVIRONMENT    | The name in uppercase letters of the deployment target |

### Example
```
env:
  MERLIN_PRODUCT_NAME: rbi-merlin
  MERLIN_COMPONENT_NAME: my_service_component
  MERLIN_RELEASE: 0.0.2
  MERLIN_BUILD_NUMBER: ${{github.run_number}}

jobs:
  # Build
  build:
    # should run on self-hosted runners with build label
    runs-on: [self-hosted, build]

    steps:
    - name: check out this repo
      uses: actions/checkout@v2
  
    - name: Run Raiffeisen Build Automation using Merlin GHA Helper
      uses: raiffeisenbankinternational/merlin-gha-helper@v2.0.0
      with:
        action-type: 'build'

deploy:
      # should run on self-hosted runners with deploy label
      runs-on: [self-hosted, deploy-play01]

      needs: build
      
      steps:
        - name: Run Deployment
          uses: raiffeisenbankinternational/merlin-gha-helper@v2.0.0
          with:
            action-type: 'deploy'
          env:
            MERLIN_ACCOUNT: MY_MERLIN_ACCOUNT
            MERLIN_ENVIRONMENT: DEV01
```
