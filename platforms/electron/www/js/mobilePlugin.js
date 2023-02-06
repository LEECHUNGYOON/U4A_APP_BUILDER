/* ***************************************************************** */
// 설치 npm 
// npm install node-ssh
/* ***************************************************************** */

/* ***************************************************************** */
// I/F 필드 정의 
/* ***************************************************************** */
/*
*/
/* ***************************************************************** */
/* ***************************************************************** */
/* 사용 예시 
    var mPluginInfo = require(oAPP.path.join(__dirname, 'js/mobilePlugin.js'));
    var retdata = await mPluginInfo.getPlugin(oAPP.remote, oAPP.path, oAPP.fs, 'C:\u4a_temp');

    retdata.RETCD  <-- E:오류 / S:성공 
    retdata.RTMSG  <-- 처리 메시지 
    retdata.TMPDIR <-- 완료후 삭제 시작 폴더 경로
    retdata.T_PATH <-- 설치 대상 PLUGIN 로컬 경로
      
*/
/* ***************************************************************** */
/* ***************************************************************** */
/* 내부 광역 변수  
/* ***************************************************************** */



/* ***************************************************************** */
/* 내부 전역 펑션 
/* ***************************************************************** */

function fn_generateRandomString(num) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < num; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;

}

async function getDIR(FS, PATH, TMPSavePath) {
    return new Promise((resolve, reject) => {

        var T_PATH = [];

        FS.readdir(TMPSavePath, (err, files) => {

            if (err) {
                resolve({ RETCD: "E", RTMSG: err.toString() });
                return;
            }

            files.forEach(file => {
                var sPath = PATH.join(TMPSavePath, file);
                T_PATH.push(sPath);
            });

            resolve({ RETCD: "S", T_PATH: T_PATH, PLUGINS: files });

        });

    });
}

async function getPluginFolderList(SSH) {

    return new Promise((resolve) => {

        SSH.execCommand('cd u4arnd/05.U4A_CORDOVA/plugins && ls -d */', {}).then(function (result) {

            if (result.code !== 0 || result.stderr !== "") {
                resolve({ "RETCD": "E", "RTMSG": "plugin 파일정보가 누락되었습니다." });
                return;
            }

            let aFolderList = result.stdout.split("\n"),
                iListLength = aFolderList.length;

            let aList = [];
            for (var i = 0; i < iListLength; i++) {

                const sName = aFolderList[i];

                let sFolderName = sName.replaceAll("/", "");
                aList.push(sFolderName);

            }

            resolve({ "RETCD": "S", "RTDATA": aList });

        });

    });

}

const
    PLUGIN_CONN_INFO = {
        host: 'u4arnd.iptime.org',
        username: 'u4arnd',
        port: 9541,
        password: '#u4aRnd$',
        tryKeyboard: true,
    },
    PLUGIN_ROOT_PATH = "/mnt/Data/U4ARND/u4arnd/05.U4A_CORDOVA/plugins";

/* ================================================================= */
/* Export Module Function 
/* ================================================================= */
exports.getPlugin = async function (PATH, FS, ROOTPATH, sRandomKey, VERSION, ISDEV) {
    return new Promise(async (resolve, reject) => {

        let NodeSSH = require('node-ssh').NodeSSH;

        const ssh = new NodeSSH();

        let SSH = await ssh.connect(PLUGIN_CONN_INFO);

        //접근 실패
        if (!SSH.isConnected()) {
            SSH.dispose();
            SSH = null;
            resolve({ "RETCD": "E", "RTMSG": "NAS 연결실패" });
            return;

        }

        var LocalStorageROOT = ROOTPATH;

        //== 임시 폴더 생성 ================================//

        //임시 폴더명 
        // var TMPSavePath = PATH.join(LocalStorageROOT, fn_generateRandomString(50));
        var TMPSavePath = PATH.join(LocalStorageROOT, sRandomKey);

        if (!FS.existsSync(TMPSavePath)) {
            FS.mkdirSync(TMPSavePath);
        }

        var NAS_PATH = `${PLUGIN_ROOT_PATH}/${VERSION}`; //PLUGIN_ROOT_PATH + "/"
        if (ISDEV == "X") {
            NAS_PATH += "_dev";
        }

        try {
            await SSH.getDirectory(TMPSavePath, NAS_PATH);
        } catch (error) {
            SSH.dispose();
            resolve({ "RETCD": "E", "RTMSG": "plugin 파일정보가 누락되었습니다." });
            return;

        }

        SSH.dispose();

        //Plugin 정보 추출
        var oResult = await getDIR(FS, PATH, TMPSavePath);
        if (oResult.RETCD == "E") {
            resolve({ "RETCD": "E", "RTMSG": oResult.RTMSG });
            return;
        }

        var T_PATH = oResult.T_PATH,
            PLUGINS = oResult.PLUGINS;

        if (T_PATH.length == 0) {
            resolve({ "RETCD": "E", "RTMSG": "plugin 파일정보가 누락되었습니다." });
            return;
        }

        resolve({ "RETCD": "S", "RTMSG": "", "TMPDIR": TMPSavePath, "T_PATH": T_PATH, "PLUGINS": PLUGINS });

    });

};


exports.getPluginFolderPath = () => {

    return new Promise(async (resolve) => {

        let NodeSSH = require('node-ssh').NodeSSH;

        const ssh = new NodeSSH();

        let SSH = await ssh.connect(PLUGIN_CONN_INFO);

        //접근 실패
        if (!SSH.isConnected()) {
            SSH.dispose();
            SSH = null;
            resolve({ "RETCD": "E", "RTMSG": "NAS 연결실패" });
            return;

        }

        // 플러그인 폴더명 구하기
        let oResult = await getPluginFolderList(SSH);

        SSH.dispose();
        SSH = null;
        resolve(oResult);

    });

};