const fs = require('fs');
const appRoot = require('app-root-path');

const Messenger = require(`${appRoot}/src/utils/messenger`);
const Workspace = require(`${appRoot}/src/components/workspace`);

class VolumesBackupController {

    constructor() { }

    async init() {
        let _self = this;
        await _self.initWorkspace();
    }

    initWorkspace = async () => {
        Messenger.openClose('CONTROLLER:INIT WORKSPACE');
        let _self = this;
        _self._workspace = new Workspace();
        await _self._workspace.init();
        await _self._workspace.setupWorkspace();
        await _self._workspace.scanVolumesPath();
        await _self._workspace.getWeekFolders();
        await _self._workspace.createDistFolder();
        Messenger.openClose('/CONTROLLER:INIT WORKSPACE');
    }

    async startBackup() {
        Messenger.openClose('CONTROLLER:START BACKUP');
        let _self = this;
        _self._workspace.checkFoldersToZip();
        await _self._workspace.zipTargetFolders();
        Messenger.openClose('/CONTROLLER:START BACKUP');
    }

    async postBackupAction() {
        Messenger.openClose('CONTROLLER:POST BACKUP ACTION');
        let _self = this;
        // await _self._workspace.cleanUpVolumes();
        await _self._workspace.saveTargetFoldersList();
        Messenger.openClose('/CONTROLLER:POST BACKUP ACTION');
    }
}

module.exports = VolumesBackupController;