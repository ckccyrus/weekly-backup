const fs = require('fs');
const path = require('path');
const appRoot = require('app-root-path');
const archiver = require('archiver');
const moment = require('moment');
const { rejects } = require('assert');

const CONFIG = require(`${appRoot}/src/config/config`);
const Messenger = require(`${appRoot}/src/utils/messenger`);

class Workspace {
    _weekFolders;
    _allBackupVolumeFolders;
    _foldersToZip;
    _distFolderName;

    constructor() {
        let _self = this;
        if (!process.env.BACKUP_VOLUME_PATH) throw new Error('process.env.BACKUP_VOLUME_PATH is undefined!');
        if (!process.env.CURDATE) throw new Error('process.env.CURDATE is undefined!');
    }

    //---------------------------------------------------------------
    //------------------------------Init---------------------------------

    async init() {
        let _self = this;
        _self._weekFolders = [];
        _self._allBackupVolumeFolders = [];
        _self._distFolderName = '';
    }

    async setupWorkspace() {
        Messenger.openClose('WORKSPACE:SETUP WORK SPACE');
        let _workspaceLoc = CONFIG.DIRECTORY.WORKSPACE,
            _isWorkspaceExist = fs.existsSync(_workspaceLoc);

        if (_isWorkspaceExist) {
            await clearWorkspace();
        }
        await fs.promises.mkdir(_workspaceLoc);

        Messenger.openClose('/WORKSPACE:SETUP WORK SPACE');

        async function clearWorkspace() {
            let _workspaceFolderStat = await fs.promises.lstat(_workspaceLoc),
                _isDirectory = _workspaceFolderStat.isDirectory();
            if (_isDirectory) {
                try {
                    await fs.promises.rm(_workspaceLoc, { recursive: true });
                } catch ($err) {
                    Messenger.error('[CLEAR_WORKSPACE_FAIL]');
                }
            }
        }
    }

    async scanVolumesPath() {
        Messenger.openClose(`WORKSPACE:SCAN VOLUMES: ${process.env.BACKUP_VOLUME_PATH}`);
        let _self = this,
            _isVolumePathExist = fs.existsSync(process.env.BACKUP_VOLUME_PATH);

        if (_isVolumePathExist) {
            const _allFolders = await fs.promises.readdir(process.env.BACKUP_VOLUME_PATH),
                _allVisibleFolders = _allFolders.filter(item => !/(^|\/)\.[^/.]/g.test(item));  //ignore hicdden files

            _self._allBackupVolumeFolders = _allVisibleFolders;
        } else {
            throw new Error(`${process.env.BACKUP_VOLUME_PATH} is not exist`);
        }

        Messenger.openClose(`/WORKSPACE:SCAN VOLUMES: ${process.env.BACKUP_VOLUME_PATH}`);
    }

    async getWeekFolders() {
        Messenger.openClose(`WORKSPACE:GET WEEK FOLDERS FROM ${process.env.CURDATE}`);
        let _self = this,
            _date = moment(process.env.CURDATE, 'YYYY-MM-DD'),
            _startDate = _date.subtract(6, 'days'),
            _folderNames = [];

        for (let i = 0; i < 7; i++) {
            const _folderDate = _startDate.clone().add(i, 'days');
            const _folderName = _folderDate.format('YYYY-MM-DD');
            _folderNames.push(_folderName);
        }

        _self._weekFolders = _folderNames;

        Messenger.openClose(`/WORKSPACE:GET WEEK FOLDERS FROM ${process.env.CURDATE}`);
    }

    async createDistFolder() {
        Messenger.openClose('WORKSPACE:CREATE DIST FOLDER');
        let _self = this,
            _workspaceLoc = CONFIG.DIRECTORY.WORKSPACE,
            _isWorkspaceExist = fs.existsSync(_workspaceLoc),
            _weekFoldersArr = _self._weekFolders,
            [_startDate, ..._rest] = _weekFoldersArr,
            _endDate = _weekFoldersArr[_weekFoldersArr.length - 1],
            _folderName = _startDate + '--' + _endDate,
            _distFolderLoc = path.join(CONFIG.DIRECTORY.DIST, _folderName);

        if (_isWorkspaceExist) {
            await fs.promises.mkdir(_distFolderLoc);
            _self._distFolderName = _folderName;
        } else {
            throw new Error('WORKSPACE:[CREATE_DIST_FOLDER_FAIL]');
        }

        Messenger.openClose('/WORKSPACE:CREATE DIST FOLDER');
    }

    //---------------------------------------------------------------
    //------------------------------Start backup---------------------------------

    checkFoldersToZip() {
        Messenger.openClose('WORKSPACE:CHECK FOLDERS TO ZIP');
        let _self = this,
            _folderNames = _self._allBackupVolumeFolders.filter($eachFolder => _self._weekFolders.includes($eachFolder));

        _self._foldersToZip = _folderNames;

        Messenger.openClose('/WORKSPACE:CHECK FOLDERS TO ZIP');
    }

    async zipTargetFolders() {
        Messenger.openClose('WORKSPACE:ZIP TARGET FOLDERS');
        let _self = this;
        console.log('DEBUG TARGET FOLDERS: ', _self._foldersToZip);

        for (let i = 0; i < _self._foldersToZip.length; i++) {
            let _eachFolder = _self._foldersToZip[i],
                _eachFolderSrcPath = path.join(process.env.BACKUP_VOLUME_PATH, _eachFolder),
                _eachFolderDestPath = path.join(CONFIG.DIRECTORY.DIST, _self._distFolderName),
                _isEachFolderExist = fs.existsSync(_eachFolderSrcPath);

            if (_isEachFolderExist) {
                await _self.createZip(_eachFolderSrcPath, _eachFolderDestPath, _eachFolder);
            } else {
                throw new Error(`WORKSPACE:[TARGET_FOLDER_DOES_NOT_EXIST: ${_eachFolderSrcPath}]`);
            }
        }

        Messenger.openClose('/WORKSPACE:ZIP TARGET FOLDERS');
    }

    createZip = async ($srcDir, $destDir, $folder) => {
        let _self = this,
            _destPath = path.join($destDir, $folder);

        return new Promise((resolve, reject) => {
            Messenger.print(`WORKSPACE:CREATING ZIP ... (${$srcDir})`);

            const _output = fs.createWriteStream(`${_destPath}.zip`);
            const _archive = archiver('zip', {
                zlib: { level: 9 } // set compression level
            });

            _output.on('close', () => {
                console.log(`${_archive.pointer()} total bytes`);
                Messenger.print(`WORKSPACE:FINISH ZIP ... (${_destPath}.zip)`);
                resolve();
            })

            _archive.on('warning', (err) => {
                if (err.code === 'ENOENT') {
                    console.warn(err);
                } else {
                    reject(err);
                }
            });

            _archive.on('error', (err) => {
                Messenger.print(`WORKSPACE:[FAIL_TO_ZIP]`);
                reject(err);
            });


            _archive.pipe(_output);
            _archive.directory($srcDir, false);
            _archive.finalize();
        })
    }

    //---------------------------------------------------------------
    //------------------------------Post backup action---------------------------------

    // async cleanUpVolumes() {
    //     Messenger.openClose('WORKSPACE:CLEAN UP BACKUP VOLUMES');
    //     let _self = this,
    //         _distFolder = path.join(CONFIG.DIRECTORY.DIST, _self._distFolderName),
    //         _foldersInDistFolder = await fs.promises.readdir(_distFolder),
    //         _isAllZipped = _foldersInDistFolder.length === _self._foldersToZip.length;

    //     if(!_isAllZipped) {
    //         throw new Error(`Not all folders are zipped`);
    //     }

    //     for (let i = 0; i < _self._foldersToZip.length; i++) {
    //         let _eachFolder = _self._foldersToZip[i],
    //             _eachFolderSrcPath = path.join(process.env.BACKUP_VOLUME_PATH, _eachFolder),
    //             _isEachFolderExist = fs.existsSync(_eachFolderSrcPath);

    //         if (_isEachFolderExist) {
    //             await fs.promises.rm(_eachFolderSrcPath, { recursive: true })
    //         } else {
    //             throw new Error(`WORKSPACE:[FOLDER_DOES_NOT_EXIST: ${_eachFolderSrcPath}]`);
    //         }
    //     }

    //     Messenger.openClose('/WORKSPACE:CLEAN UP BACKUP VOLUMES');
    // }

    async saveTargetFoldersList() {
        Messenger.openClose('WORKSPACE:SAVE TARGET FOLDER LIST');
        let _self = this,
            _distFolder = path.join(CONFIG.DIRECTORY.DIST, _self._distFolderName),
            _foldersInDistFolder = await fs.promises.readdir(_distFolder),
            _isAllZipped = _foldersInDistFolder.length === _self._foldersToZip.length,
            _result = {};

        if (!_isAllZipped) {
            throw new Error(`Not all folders are zipped`);
        }

        // _self._foldersToZip.forEach($eachFolder => {
        //     _result[$eachFolder] = $eachFolder;
        // });

        await fs.promises.writeFile(path.join(CONFIG.DIRECTORY.DIST, '.result'), JSON.stringify(_self._foldersToZip));

        Messenger.openClose('/WORKSPACE:SAVE TARGET FOLDER LIST');
    }
}

module.exports = Workspace;