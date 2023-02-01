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

            files.forEach(file => {
                var sPath = PATH.join(TMPSavePath, file);
                T_PATH.push(sPath);
            });

            resolve(T_PATH);

        });

    });
}




/* ================================================================= */
/* Export Module Function 
/* ================================================================= */
exports.getPlugin = async function (PATH, FS, ROOTPATH, sRandomKey) {
    return new Promise(async (resolve, reject) => {

        let NodeSSH = require('node-ssh').NodeSSH;

        const ssh = new NodeSSH();
        const Lpassword = '#u4aRnd$';

        let SSH = await ssh.connect({
            host: 'u4arnd.iptime.org',
            username: 'u4arnd',
            port: 9541,
            password: Lpassword,
            tryKeyboard: true,

        });


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

        //U:\contents\cordova\plugins
        var NAS_PATH = "/mnt/Data/U4ARND/u4arnd/05.U4A_CORDOVA/plugins/android_10.1.2_dev";

        // 실행된 컴퓨터가 서버 컴퓨터 일 경우
        if (process.env.COMPUTERNAME == process.env.SERVER_COMPUTERNAME) {
            NAS_PATH = "/mnt/Data/U4ARND/u4arnd/05.U4A_CORDOVA/plugins/android_10.1.2";
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
        var T_PATH = await getDIR(FS, PATH, TMPSavePath);

        if (T_PATH.length == 0) {
            resolve({ "RETCD": "E", "RTMSG": "plugin 파일정보가 누락되었습니다." });
            return;
        }

        resolve({ "RETCD": "S", "RTMSG": "", "TMPDIR": TMPSavePath, "T_PATH": T_PATH });

    });

};