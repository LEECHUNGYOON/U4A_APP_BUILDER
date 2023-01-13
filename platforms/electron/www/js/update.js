(() => {
    "use strict";

    const IPCRENDERER = require('electron').ipcRenderer;

    IPCRENDERER.on('if-update-info', (events, oInfo) => {

        const
            remote = require('@electron/remote'),
            dialog = remote.require('electron').dialog,
            currwin = remote.getCurrentWindow();

        // 업데이트 중 오류가 발생한 경우 메시지 띄우고 창을 닫는다.
        if (oInfo.prc && oInfo.prc == "E") {

            let sTitle = "auto update error";

            dialog.showMessageBox(currwin, {
                title: sTitle,
                message: oInfo.status,
                type: "error"
            }).then(() => {

                currwin.close();

            });

            return;
        }

        let oProgress = document.getElementById("progressBar_dynamic"),
            oStatus = document.getElementById("statusText"),
            oVer = document.getElementById("versionTxt");

        if (oInfo.status) {
            oStatus.innerHTML = oInfo.status;
        }

        if (oInfo.ver) {
            oVer.innerHTML = oInfo.ver;
        }

        if (oInfo.per) {
            oProgress.style.width = `${oInfo.per}%`;
        }

    });

})();