# Merlin GitHub Actions Helper

This custom action calls Raiffeisen Build Automation (RBA) and/or Merlin deployment scripts. It is expected to run on self-hosted build servers where RBA is pre-installed and on deployment servers of Merlin PaaS accounts. 
This action is using [GitHub Actions Toolkit](https://github.com/actions/toolkit) which is a collection of Node.js packages. 

## Inputs

### `action-type`

**Required** Type of action. Allowed values: build or deploy

## Example usage

```
- name: Run Raiffeisen Build Automation
  uses: raiffeisenbankinternational/merlin-gha-helper@v1.0.0
  with:
    action-type: 'build'
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
  * git tag -a -m "New release" v1.0.1
  * git push --follow-tags
