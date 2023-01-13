let oAutoUpdate = {};

const
    REMOTE = require('@electron/remote'),
    CURRWIN = REMOTE.getCurrentWindow();

const
    remote = require('@electron/remote'),
    remoteMain = require('@electron/remote/main'),
    app = remote.app,
    path = remote.require('path'),
    apppath = app.getAppPath(),
    dialog = remote.dialog,
    autoUpdater = remote.require("electron-updater").autoUpdater;

function fnShowUpdatePopup(fnCallback) {

    let loadUrl = path.join(apppath, "update.html"),
        appIcon = path.join(apppath, "/img/logo.png");

    let browserWindowOpts = {        
        "icon": appIcon,
        "height": 150,
        "width": 400,
        "frame": false,
        "alwaysOnTop": true,
        "autoHideMenuBar": true,
        "backgroundColor": "#030303",
        "webPreferences": {
            "devTools": true,
            "nodeIntegration": true,
            "enableRemoteModule": true,
            "contextIsolation": false,
            "backgroundThrottling": false,
            "nativeWindowOpen": true,
            "webSecurity": false
        }
    };

    var oBrowserWindow = new REMOTE.BrowserWindow(browserWindowOpts);  

    oBrowserWindow.loadURL(loadUrl, browserWindowOpts);

    // oBrowserWindow.webContents.openDevTools();

    oBrowserWindow.webContents.on('did-finish-load', function () {

        fnCallback(oBrowserWindow);

    });

    // Emitted when the window is closed.
    oBrowserWindow.on('closed', () => {

        CURRWIN.show();

        oBrowserWindow = null;

    });

    var remote = require('@electron/remote');
    remote.require('@electron/remote/main').enable(oBrowserWindow.webContents);

} // end of fnShowUpdatePopup

oAutoUpdate.checkUpdate = () => {

    return new Promise((resolve, reject) => {

        let oCurrWin = remote.getCurrentWindow();
        oCurrWin.hide();

        fnShowUpdatePopup((oBrowserWindow) => {

            autoUpdater.on('checking-for-update', () => {

                oBrowserWindow.webContents.send('if-update-info', {
                    status: "업데이트 확인 중..."
                });

                console.log("업데이트 확인 중...");

            });

            autoUpdater.on('update-available', (info) => {

                oBrowserWindow.webContents.send('if-update-info', {
                    status: "업데이트 확인 중..."
                });              

                console.log("업데이트가 가능합니다.");

            });

            autoUpdater.on('update-not-available', (info) => {

                oBrowserWindow.close();

                resolve();

                console.log("현재 최신버전입니다.");

            });

            autoUpdater.on('error', (err) => {

                let sErrMsg = `[update Error] : ${err.toString()}`;

                // Progressbar 팝업 쪽에 오류 메시지를 던진다.
                oBrowserWindow.webContents.send('if-update-info', {
                    prc: "E",
                    status: sErrMsg
                });

                // update Progress Popup 닫기
                oBrowserWindow.close();

                resolve();

            });

            autoUpdater.on('download-progress', (progressObj) => {

                var iPer = parseFloat(progressObj.percent).toFixed(2);

                oBrowserWindow.webContents.send('if-update-info', {
                    status: "Downloading...",
                    per: iPer
                });

                console.log("Downloading..." + iPer);

            });

            autoUpdater.on('update-downloaded', (info) => {

                oBrowserWindow.webContents.send('if-update-info', {
                    status: "업데이트가 완료되었습니다. 앱을 재시작 합니다."
                });

                console.log('업데이트가 완료되었습니다.');

                setTimeout(() => {

                    oBrowserWindow.close();

                    autoUpdater.quitAndInstall(); //<--- 자동 인스톨 

                }, 3000);

            });

            autoUpdater.checkForUpdates();

        });

    });

}; // end of oAutoUpdate.checkUpdate

module.exports = oAutoUpdate;