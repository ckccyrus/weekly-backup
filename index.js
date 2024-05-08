const appRoot = require('app-root-path');

const WeeklyBackupController = require(`${appRoot}/src/controller/weeklyBackup`)
const Messenger = require(`${appRoot}/src/utils/messenger`);


function getArgvValue($argv) {
    let _index = process.argv.indexOf($argv);
    return (_index === -1) ? null : process.argv[_index + 1];
}

function checkArgv() {
    let _backup_volume_path = getArgvValue('BACKUP_VOLUME_PATH'),
        _curDate = getArgvValue('CURDATE');

    if (!_backup_volume_path || !_curDate) {
        throw ("Missing required argument:");
    }

    process.env.BACKUP_VOLUME_PATH = _backup_volume_path;
    process.env.CURDATE = _curDate;
}


async function main() {
    Messenger.openClose('MAIN');

    try {
        checkArgv();
        // console.log('DEBUG process.env', process.env);

        let _weeklyBackupController = new WeeklyBackupController();
        await _weeklyBackupController.init();
        await _weeklyBackupController.startBackup();
        await _weeklyBackupController.postBackupAction();
    } catch ($err) {
        throw new Error($err);
    }

    Messenger.openClose('/MAIN');
}

main();