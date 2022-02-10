const
    FS = require('fs-extra'),
    UGLIFYJS = require("uglify-js"),
    RANDOMKEY = require('random-key'),
    TEMP_PATH = "C:\\Temp",
    U4A_BUILD_PATH = TEMP_PATH + "\\u4a_app_build",
    U4A_WWW = TEMP_PATH + "\\u4a_www",
    U4A_WWW_DBG = U4A_WWW + "\\debug",
    U4A_WWW_REL = U4A_WWW + "\\release";

var oAPP = {};

oAPP.getRandomKey = function (fnSuccess) {

    var sRandomKey = RANDOMKEY.generate(60),
        sCreateFolderPath = U4A_BUILD_PATH + "\\" + sRandomKey;

    oAPP.mkDirBuildFolder(TEMP_PATH);
    oAPP.mkDirBuildFolder(U4A_BUILD_PATH);

    FS.exists(sCreateFolderPath, function (bIsExists) {

        if (bIsExists) {
            oAPP.getRandomKey(fnSuccess);
            return;
        }

        FS.mkdir(sCreateFolderPath, (err) => {

            if (err) {
                return;
            }

            fnSuccess(sRandomKey);

        });

    });

}; // end of oAPP.getRandomKey

oAPP.getLocalServerIp = function () {

    var OS = require('os'),
        oInterface = OS.networkInterfaces(),
        sIp = '';

    for (var dev in oInterface) {

        var alias = 0;

        oInterface[dev].forEach(function (details) {

            if (details.family == 'IPv4' && details.internal === false) {

                sIp = details.address;

                ++alias;

            }

        });

    }

    return sIp;

}; // end of oAPP.getLocalServerIp

// APPID 입력 체크
oAPP.checkValidAppId = function (sAppId) {

    var oRetMsg = {
        CODE: "E",
        TYPE: "APPID",
        MSG: ""
    };

    // 입력 여부 확인
    if (!sAppId) {
        oRetMsg.MSG = "App ID를 입력하세요";
        return oRetMsg;
    }

    // 입력길이 확인
    if (sAppId.length > 20) {
        oRetMsg.MSG = "20자 이하만 입력 가능합니다";
        return oRetMsg;
    }

    // 특수문자 입력 체크
    var bIsValid = oAPP.checkSpecial(sAppId);
    if (bIsValid) {
        oRetMsg.MSG = "특수문자를 포함하면 안됩니다";
        return oRetMsg;
    }

    // 공백 있음
    var bIsValid = oAPP.checkSpace(sAppId);
    if (bIsValid) {
        oRetMsg.MSG = "공백을 포함하면 안됩니다";
        return oRetMsg;
    }

    // 영문+숫자
    var bIsValid = oAPP.checkEngNum(sAppId);
    if (!bIsValid) {
        oRetMsg.MSG = "영문 + 숫자만 입력가능합니다";
        return oRetMsg;
    }

    oRetMsg.CODE = "S";

    return oRetMsg;

}; // end of oAPP.checkValidAppId

// App Description 입력 체크
oAPP.checkValidAppDesc = function (sAppDesc) {

    var oRetMsg = {
        CODE: "E",
        TYPE: "APPDESC",
        MSG: ""
    };

    // 입력 여부 확인
    if (!sAppDesc) {
        oRetMsg.MSG = "App Description을 입력하세요";
        return oRetMsg;
    }

    oRetMsg.CODE = "S";

    return oRetMsg;

}; // end of oAPP.checkValidAppDesc

// Protocol 입력 체크
oAPP.checkValidProtocol = function (sProto) {

    var oRetMsg = {
        CODE: "E",
        TYPE: "PROTO",
        MSG: ""
    };

    // 입력 여부 확인
    if (!sProto) {
        oRetMsg.MSG = "Protocol을 입력하세요";
        return oRetMsg;
    }

    oRetMsg.CODE = "S";

    return oRetMsg;

}; // end of oAPP.checkValidProtocol

// Host 입력 체크
oAPP.checkValidHost = function (sHost) {

    var oRetMsg = {
        CODE: "E",
        TYPE: "HOST",
        MSG: ""
    };

    // 입력 여부 확인
    if (!sHost) {
        oRetMsg.MSG = "HOST를 입력하세요";
        return oRetMsg;
    }

    oRetMsg.CODE = "S";

    return oRetMsg;

}; // end of oAPP.checkValidHost

// Path 입력 체크
oAPP.checkValidPath = function (sPath) {

    var oRetMsg = {
        CODE: "E",
        TYPE: "HOST",
        MSG: ""
    };

    // 입력 여부 확인
    if (!sPath) {
        oRetMsg.MSG = "HOST를 입력하세요";
        return oRetMsg;
    }

    oRetMsg.CODE = "S";

    return oRetMsg;

}; // end of oAPP.checkValidPath

// 영문 + 숫자 입력 체크
oAPP.checkEngNum = function (str) {
    var regExp = /^[A-Za-z]|^[A-Za-z]+[A-Za-z0-9]+/g;

    if (regExp.test(str)) {
        return true;
    } else {
        console.log("영문+숫자입력 걸림!!");
        return false;
    }
};

// 특수문자 체크
oAPP.checkSpecial = function (str) {
    var special_pattern = /[`~!@#$%^&*|\\\'\";:\/?]/gi;
    if (special_pattern.test(str) == true) {
        console.log("특수문자 걸림!!");
        return true;
    } else {
        return false;
    }
};

// 공백(스페이스 바) 체크 
oAPP.checkSpace = function (str) {
    if (str.search(/\s/) !== -1) {
        console.log("공백 있음!!");
        return true;
    } else {
        return false;
    }
};

/************************************************************************************************
 * 빌드할때 임시로 저장할 Temp 폴더 생성
 ************************************************************************************************/
oAPP.mkDirBuildFolder = function (sPath) {

    const FS = require('fs-extra');

    var sFolderPath = sPath,
        isExists = FS.existsSync(sFolderPath);

    if (isExists) {
        return;
    }

    FS.mkdirSync(sFolderPath);

    return;

}; // end of oAPP.mkDirBuildFolder;

// www compress
oAPP.setWWWCompress = function () {

    var aDbgFolders = FS.readdirSync(U4A_WWW_DBG),
        aRelFolders = FS.readdirSync(U4A_WWW_REL),
        iDbgLength = aDbgFolders.length;

    for (var i = 0; i < iDbgLength; i++) {

        var sVerPath = aDbgFolders[i];

        var sDbgVerPath = U4A_WWW_DBG + "\\" + sVerPath,
            sRelVerPath = U4A_WWW_REL + "\\" + sVerPath;

        var oFound = aRelFolders.find(element => element == sVerPath);
        if (typeof oFound != "undefined") {
            continue;
        }

        // 버전별 debug에 있는 파일을 release 폴더로 복사한다.
        FS.copySync(sDbgVerPath, sRelVerPath);

        var sJsFolderPath = sRelVerPath + "\\www\\js",
            aWWWFolders = FS.readdirSync(sJsFolderPath),
            iWWWFolderLen = aWWWFolders.length;

        for (var j = 0; j < iWWWFolderLen; j++) {

            var sFilePath = sJsFolderPath + "\\" + aWWWFolders[j];

            var sJsFileData = FS.readFileSync(sFilePath, 'utf-8');

            // js compress
            var oCompResult = oAPP.setJsCompress(sJsFileData);

            if (typeof oCompResult.error !== "undefined") {

                var oError = oCompResult.error,
                    sMsg = "message: " + oError.message + "\n";
                sMsg += "line: " + oError.line;

                console.log(sMsg);

                alert(sMsg);

                return;
            }

            var sCode = oCompResult.code;

            FS.writeFileSync(sFilePath, sCode, 'utf-8');

        } // end of for j

    } // end of for i

}; // end of oAPP.setWWWCompress

// 버전별 www 폴더 암호화
oAPP.setWWWCompressforVersion = function (sVer) {

    var oRetCod = {
        RETCD: "E",
        MSGTXT: "",
        DATA: ""
    };

    var aRelFolders = FS.readdirSync(U4A_WWW_REL),
        oFound = aRelFolders.find(element => element == sVer);

    if (typeof oFound == "undefined") {
        oRetCod.MSGTXT = "해당 버전이 없습니다.";
        return oRetCod;
    }

    var sRelVerPath = U4A_WWW_REL + "\\" + sVer,
        sJsFolderPath = sRelVerPath + "\\www\\js",

        aWWWFolders = FS.readdirSync(sJsFolderPath),
        iWWWFolderLen = aWWWFolders.length;

    for (var i = 0; i < iWWWFolderLen; i++) {

        var sFilePath = sJsFolderPath + "\\" + aWWWFolders[i],
            sJsFileData = FS.readFileSync(sFilePath, 'utf-8');

        // js compress
        var oCompResult = oAPP.setJsCompress(sJsFileData);

        if (typeof oCompResult.error !== "undefined") {

            var oError = oCompResult.error,
                sMsg = "message: " + oError.message + "\n";
            sMsg += "line: " + oError.line;

            console.log(sMsg);

            oRetCod.MSGTXT = sMsg;

            return oRetCod;

        } // end of if

        var sCode = oCompResult.code;

        // 파일 권한 체크
        var iFileChmod = FS.statSync(sFilePath).mode;

        // read 권한일 경우 change 권한으로 변환
        if (iFileChmod == 33060) {
            FS.chmodSync(sFilePath, 0o666);
        }

        FS.writeFileSync(sFilePath, sCode, 'utf-8');

    } // end of for i

    oRetCod.RETCD = 'S';

    return oRetCod;

}; // end of oAPP.setWWWCompressforVersion

oAPP.setJsCompress = function (sCode) {

    return UGLIFYJS.minify(sCode);

}; // end of setJsCompress

module.exports = oAPP;