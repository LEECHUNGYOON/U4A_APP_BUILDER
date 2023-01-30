self.onmessage = (oEvent) => {

    debugger;

    const
        PATH = require('path'),
        FS = require('fs'),
        IP_ADDR = require("ip"),
        ZIP = require("zip-lib"),
        NodeSSH = require('node-ssh').NodeSSH;

    // 리턴 메시지 구조
    let oReturnMsg = {
        RETCD: "",
        RTMSG: ""
    };

    let oReqData = oEvent.data,
        APPPATH = oReqData.APPPATH,
        oFormData = oReqData.oFormData,
        MPLUGININFO = require(PATH.join(APPPATH, "js/mobilePlugin.js")),
        CONFPATH = PATH.join(APPPATH, "conf") + "\\config.json",
        PATHINFO = require(CONFPATH).pathInfo,
        sRandomKey = oReqData.sRandomKey;


    let oAPP = {};

    // 최신버전의 파일 원본을 방금 생성한 폴더에 Overrite 한다.
    oAPP.onCopyOrgToCrateApp = function (oFormData, sRandomKey) {

        const FS = require('fs-extra');

        var oFields = oFormData.FIELDS,
            isDbg = oFields.ISDBG,
            sWWWFolderPath = "";

        if (isDbg == "X") {
            sWWWFolderPath = PATHINFO.U4A_WWW_DBG;
        } else {
            sWWWFolderPath = PATHINFO.U4A_WWW_REL;
        }

        // 원본 폴더 읽기
        FS.readdir(sWWWFolderPath, (err, aFiles) => {

            if (err) {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = err.toString();

                self.postMessage(oReturnMsg);

                return;
            }

            var iOrgFileLength = aFiles.length;
            if (iOrgFileLength <= 0) {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = "복사할 파일 대상이 없습니다.";

                self.postMessage(oReturnMsg);

                return;
            }

            var sVerPath = aFiles[iOrgFileLength - 1], // 최신 버전 폴더명         
                oFields = oFormData.FIELDS,
                sAppId = oFields.APPID,
                sFolderPath = PATHINFO.U4A_BUILD_PATH, // build 폴더 경로            
                sSourcePath = sWWWFolderPath + "\\" + sVerPath, // 복사 대상 폴더 위치
                sTargetPath = sFolderPath + "\\" + sRandomKey + "\\" + sAppId; // 붙여넣을 폴더 위치

            FS.copy(sSourcePath, sTargetPath).then(function () {

                oReturnMsg.RETCD = "M";
                oReturnMsg.RTMSG = `[${sAppId}] WWW 폴더 복사완료`;

                self.postMessage(oReturnMsg);

                // index.js의 각종 파라미터들을 Replace 한다.
                oAPP.onReplaceParamToIndexJs(oFormData, sRandomKey);

            }).catch(function (err) {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = err.toString();

                self.postMessage(oReturnMsg);

            });

        });

    }; // end of oAPP.onCopyOrgToCrateApp

    // index.js의 각종 파라미터들을 Replace 한다.
    oAPP.onReplaceParamToIndexJs = function (oFormData, sRandomKey) {

        const FS = require('fs-extra');

        var oFields = oFormData.FIELDS,
            sAppId = oFields.APPID,
            oParams = {
                PROTO: oFields["PROTO"],
                HOST: oFields["HOST"],
                PORT: oFields["PORT"],
                PATH: oFields["PATH"],
                PARAM: oFields["PARAM"]
            };

        var sBuildAppPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
            sIndexJsPath = sBuildAppPath + "\\www\\js\\index.js";

        FS.readFile(sIndexJsPath, {
            encoding: "utf-8"
        }, (err, data) => {

            if (err) {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = err.toString();

                self.postMessage(oReturnMsg);

                return;
            }

            var sIndexJsTxt = data;

            sIndexJsTxt = sIndexJsTxt.replace(/&PARAM1&/g, oParams.PROTO);
            sIndexJsTxt = sIndexJsTxt.replace(/&PARAM2&/g, oParams.HOST);
            sIndexJsTxt = sIndexJsTxt.replace(/&PARAM3&/g, oParams.PORT);
            sIndexJsTxt = sIndexJsTxt.replace(/&PARAM4&/g, oParams.PATH);
            sIndexJsTxt = sIndexJsTxt.replace(/&PARAM5&/g, oParams.PARAM);

            FS.unlink(sIndexJsPath, (err) => {
                if (err) {

                    oReturnMsg.RETCD = "E";
                    oReturnMsg.RTMSG = err.toString();

                    self.postMessage(oReturnMsg);

                    return;
                }

                FS.writeFile(sIndexJsPath, sIndexJsTxt, function (err) {

                    if (err) {

                        oReturnMsg.RETCD = "E";
                        oReturnMsg.RTMSG = err.toString();

                        self.postMessage(oReturnMsg);

                        return;
                    }

                    oReturnMsg.RETCD = "M";
                    oReturnMsg.RTMSG = `[${sAppId}] index.js write 성공`;

                    self.postMessage(oReturnMsg);

                    // config.xml replace
                    oAPP.onReplaceParamToConfigXml(oFormData, sRandomKey);

                }); // end of FS.writeFile

            }); // end of FS.unlink

        }); // end of FS.readFile

    }; // end of oAPP.onReplaceParamToIndexJs

    // config xml 수정
    oAPP.onReplaceParamToConfigXml = function (oFormData, sRandomKey) {

        const FS = require('fs-extra');

        var oFields = oFormData.FIELDS,
            oFiles = oFormData.FILES,
            sAppId = oFields.APPID,
            sAppDesc = oFields.APPDESC,
            sBuildAppPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
            sConfigXmlPath = sBuildAppPath + "\\config.xml",
            oReadFileOptions = {
                encoding: "utf-8"
            };

        FS.readFile(sConfigXmlPath, oReadFileOptions, (err, data) => {

            if (err) {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = err.toString();

                self.postMessage(oReturnMsg);

                return;
            }

            var sXmlTextData = data;

            sXmlTextData = sXmlTextData.replace(/&PARAM1&/g, "com." + sAppId + ".app");
            sXmlTextData = sXmlTextData.replace(/&PARAM2&/g, sAppDesc);

            FS.unlink(sConfigXmlPath, (err) => {
                if (err) {

                    oReturnMsg.RETCD = "E";
                    oReturnMsg.RTMSG = err.toString();

                    self.postMessage(oReturnMsg);

                    return;
                }

                FS.writeFile(sConfigXmlPath, sXmlTextData, function (err) {

                    if (err) {

                        oReturnMsg.RETCD = "E";
                        oReturnMsg.RTMSG = err.toString();

                        self.postMessage(oReturnMsg);

                        return;
                    }

                    oReturnMsg.RETCD = "M";
                    oReturnMsg.RTMSG = `[${sAppId}] config.xml write 성공`;

                    self.postMessage(oReturnMsg);


                    var oPromise1 = oAPP.onShortCutImageChange(oFormData, sRandomKey),
                        oPromise2 = oAPP.onIntroImageChange(oFormData, sRandomKey);

                    Promise.all([oPromise1, oPromise2]).then(() => {

                        // android platform 추가하기
                        oAPP.addPlatformAndroid(oFormData, sRandomKey);

                    });

                }); // end of FS.writeFile

            }); // end of FS.unlink

        }); // end of FS.readFile

    }; // end of oAPP.onReplaceParamToConfigXml

    oAPP.onShortCutImageChange = function (oFormData, sRandomKey) {

        return new Promise((resolve, reject) => {

            const FS = require('fs-extra');

            var oFields = oFormData.FIELDS,
                oFiles = oFormData.FILES,
                sAppId = oFields.APPID;

            var oShortCutImg = oFiles["SHORTCUT"];

            if (!oShortCutImg) {
                resolve('X');
                return;
            }

            var sShortCutImgPath = oShortCutImg.filepath;

            FS.readFile(sShortCutImgPath, (err, data) => {

                if (err) {
                    resolve('X');
                    return;
                }

                var sBuildAppPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
                    sLogoImgPath = sBuildAppPath + "\\www\\img\\logo.png";

                FS.unlink(sLogoImgPath, function (err) {

                    if (err) {
                        resolve('X');
                        return;
                    }

                    FS.writeFile(sLogoImgPath, data, function (err) {

                        if (err) {
                            resolve('X');
                            return;
                        }

                        oReturnMsg.RETCD = "M";
                        oReturnMsg.RTMSG = `[${sAppId}] ShortCut Image write 성공`;

                        self.postMessage(oReturnMsg);

                        resolve('X');

                    }); // end of writeFile

                });

            }); // end of FS.readFile

        }); // end of Promise

    }; // end of oAPP.onShortCutImageChange

    oAPP.onIntroImageChange = function (oFormData, sRandomKey) {

        return new Promise((resolve, reject) => {

            const FS = require('fs-extra');

            var oFields = oFormData.FIELDS,
                oFiles = oFormData.FILES,
                sAppId = oFields.APPID;

            var oIntroImg = oFiles["INTRO"];

            if (!oIntroImg) {
                resolve('X');
                return;
            }

            var sIntroImgPath = oIntroImg.filepath;

            FS.readFile(sIntroImgPath, (err, data) => {

                if (err) {
                    resolve('X');
                    return;
                }

                var sBuildAppPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
                    sLogoImgPath = sBuildAppPath + "\\www\\img\\intro.png";

                FS.unlink(sLogoImgPath, function (err) {
                    if (err) {
                        resolve('X');
                        return;
                    }

                    FS.writeFile(sLogoImgPath, data, function (err) {

                        if (err) {
                            resolve('X');
                            return;
                        }

                        oReturnMsg.RETCD = "M";
                        oReturnMsg.RTMSG = `[${sAppId}] Intro Image Write 성공`;

                        self.postMessage(oReturnMsg);

                        resolve('X');

                    }); // end of writeFile

                });

            }); // end of FS.readFile

        });

    }; // end of oAPP.onIntroImageChange

    // android platform 추가하기
    oAPP.addPlatformAndroid = function (oFormData, sRandomKey) {

        const NODECMD = require("node-cmd");

        var oFields = oFormData.FIELDS,
            sAppId = oFields.APPID,
            sFolderPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId;

        // cordova android 생성
        var sCmd = "cd c:\\";
        sCmd += " && cd " + sFolderPath;
        sCmd += ` && cordova platform add android@${process.env.ANDROID_LATEST_VER}`;

        oReturnMsg.RETCD = "M";
        oReturnMsg.RTMSG = `[${sAppId}] cordova platform android 설치 시작!`;

        self.postMessage(oReturnMsg);

        NODECMD.run(sCmd, function (err, data, stderr) {

            if (err) {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = err.toString();

                self.postMessage(oReturnMsg);

                return;
            }

            oReturnMsg.RETCD = "M";
            oReturnMsg.RTMSG = `[${sAppId}] cordova platform android 설치 완료!`;

            self.postMessage(oReturnMsg);

            oAPP.onCopyBuildExtraFile(oFormData, sRandomKey).then(() => {

                // plugin 설치            
                oAPP.onInstallPlugins(oFormData, sRandomKey);

            });

        });

    }; // end of oAPP.addPlatformAndroid

    // APK 난독화 옵션이 있는 build-extra.gradle 파일을 복사해서 해당 옵션을 적용시키게 만든다.
    oAPP.onCopyBuildExtraFile = function (oFormData, sRandomKey) {

        return new Promise(function (resolve, reject) {

            var oFields = oFormData.FIELDS,
                sAppId = oFields.APPID,
                sBuildExtraFileName = "build-extras.gradle",
                sFolderPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId + "\\platforms\\android\\app",
                sCopyTargetPath = PATH.join(sFolderPath, sBuildExtraFileName),
                isDbg = oFields.ISDBG;

            var sOrgBuildExtraFileFolderPath = APPPATH + "\\extra",
                sOrgBuildExtraFilePath = PATH.join(sOrgBuildExtraFileFolderPath, sBuildExtraFileName);

            // debug 모드일 경우 build-extra.gradle 파일 복사를 하지 않는다.
            if (isDbg == "X") {
                resolve();
                return;
            }

            FS.copy(sOrgBuildExtraFilePath, sCopyTargetPath).then(function () {

                oReturnMsg.RETCD = "M";
                oReturnMsg.RTMSG = `[${sAppId}] Build-extra.gradle (난독화 적용 파일) 복사 성공!`;

                self.postMessage(oReturnMsg);

                resolve();

            }).catch(function (err) {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = err.toString();

                self.postMessage(oReturnMsg);

            }); // end of FS.copy

        });

    }; // end of oAPP.onCopyBuildExtraFile

    // 플러그인 설치
    oAPP.onInstallPlugins = function (oFormData, sRandomKey) {

        const NODECMD = require("node-cmd");

        var sPluginPath = PATHINFO.U4A_PLUG_JSON,
            oFields = oFormData.FIELDS,
            sAppId = oFields.APPID,
            sBuildAppPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId;

        let aPluginList = oFormData.T_PATH,
            iPathLength = aPluginList.length;

        // cordova android 생성
        var sCmd = "cd c:\\";
        sCmd += " && cd " + sBuildAppPath;

        for (var i = 0; i < iPathLength; i++) {

            const sPluginPath = aPluginList[i];

            sCmd += " && cordova plugin add " + sPluginPath;

        }

        oReturnMsg.RETCD = "M";
        oReturnMsg.RTMSG = `[${sAppId}] plugin Install 시작!`;

        self.postMessage(oReturnMsg);

        NODECMD.run(sCmd, function (err, data, stderr) {

            if (err) {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = err.toString();

                self.postMessage(oReturnMsg);

                return;
            }

            oReturnMsg.RETCD = "M";
            oReturnMsg.RTMSG = `[${sAppId}] plugin Install 종료!`;

            self.postMessage(oReturnMsg);

            // app build
            oAPP.onBuildApp(oFormData, sRandomKey);

            return;

        }); // end of NODECMD.run

    }; // end of oAPP.onInstallPlugins

    // apk build
    oAPP.onBuildApp = function (oFormData, sRandomKey) {

        const NODECMD = require("node-cmd");

        // cordova android 생성
        var oFields = oFormData.FIELDS,
            sAppId = oFields.APPID,
            isDbg = oFields.ISDBG,
            sBuildAppPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId;

        var sCmd = "";

        if (isDbg == 'X') {
            sCmd = `cd c:\\ && cd ${sBuildAppPath} && cordova build android`;
        } else {
            sCmd = `cd c:\\ && cd ${sBuildAppPath} && cordova build android --release`;
        }

        oReturnMsg.RETCD = "M";
        oReturnMsg.RTMSG = `[${sAppId}] android app 빌드 시작!`;

        self.postMessage(oReturnMsg);

        NODECMD.run(sCmd, function (err, data, stderr) {

            if (err) {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = err.toString();

                self.postMessage(oReturnMsg);

                return;
            }

            // oReturnMsg.RETCD = "M";
            // oReturnMsg.RTMSG = `[${sAppId}] android app 빌드 종료!`;

            // self.postMessage(oReturnMsg);

            oReturnMsg.RETCD = "F";
            oReturnMsg.RTMSG = `[${sAppId}] android app 빌드 종료!`;
            oReturnMsg.sRandomKey = sRandomKey;
            oReturnMsg.oFormData = oFormData;

            self.postMessage(oReturnMsg);

        }); // end of NODECMD.run

    }; // end of oAPP.onBuildApp

    // 로컬에 복사한 플러그인을 삭제한다.
    oAPP.onRemovePlugins = async (oFormData, sRandomKey) => {

        var oFields = oFormData.FIELDS,
            sAppId = oFields.APPID;

        // oAPP.writeMsg("플러그인 삭제 시작 --- (" + sAppId + ") " + sRandomKey);

        if (!FS.existsSync(oFormData.TMPDIR)) {
            // oAPP.writeMsg("플러그인 삭제 할게 없음!!");
            return;
        }

        try {

            await FS.remove(oFormData.TMPDIR);

            // console.log('success!');

            // oAPP.writeMsg("플러그인 삭제 종료!! --- (" + sAppId + ") " + sRandomKey);

        } catch (err) {
            // oAPP.writeMsg("플러그인 삭제 오류!! ");
        }

    }; // end of oAPP.onRemovePlugins

    // 빌드한 폴더 삭제
    // oAPP.removeBuildFolder = function (oFormData, sRandomKey, fnSuccess) {

    //     const FS = require('fs-extra');

    //     var oFields = oFormData.FIELDS,
    //         sAppId = oFields.APPID;

    //     var sFolderPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey;

    //     // oAPP.writeMsg("빌드폴더 삭제시작--- (" + sAppId + ") " + sRandomKey);

    //     // 폴더 삭제        
    //     FS.remove(sFolderPath, (err) => {

    //         if (err) {
    //             console.error(err);

    //             // response error
    //             _res_error(res, JSON.stringify({
    //                 "RETCD": "E",
    //                 "RTMSG": err.toString()
    //             }));

    //             // res.end(JSON.stringify({
    //             //     "RETCD": "E",
    //             //     "RTMSG": err.toString()
    //             // }));
    //             return;
    //         }

    //         oAPP.writeMsg("빌드폴더 삭제 종료----> (" + sAppId + ")" + sRandomKey);

    //         fnSuccess();

    //         return;

    //     }); // end of FS.remove

    // }; // end of oAPP.removeBuildFolder

    /**
     * START!!
     */

    oAPP.onStart = async () => {

        debugger;

        oReturnMsg.RETCD = "M";
        oReturnMsg.RTMSG = "플러그인 복사중...";

        self.postMessage(oReturnMsg);

        // 플러그인을 서버에서 로컬로 복사한다.
        var oReturnData = await MPLUGININFO.getPlugin(PATH, FS, PATHINFO.PLUGIN_PATH);
        if (oReturnData.RETCD == "E") {

            oReturnMsg.RETCD = "E";
            oReturnMsg.RTMSG = "플러그인 복사중 실패!!: " + oReturnData.RTMSG;

            self.postMessage(oReturnMsg);

            return;

        }

        oFormData.TMPDIR = oReturnData.TMPDIR;
        oFormData.T_PATH = oReturnData.T_PATH;

        var NODECMD = require("node-cmd"),
            oFields = oFormData.FIELDS,
            sAppId = oFields.APPID,
            sFolderPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey;

        // cordova android 생성
        var sCmd = "cd c:\\";
        sCmd += " && cd " + sFolderPath;
        sCmd += " && cordova create " + sAppId + " com." + sAppId + ".app " + sAppId;

        oReturnMsg.RETCD = "M";
        oReturnMsg.RTMSG = `[${sAppId}] Cordova Project 생성중`;

        self.postMessage(oReturnMsg);

        // NODECMD
        NODECMD.run(sCmd, function (err, data, stderr) {

            if (err) {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = err.toString();

                self.postMessage(oReturnMsg);

                return;
            }

            oReturnMsg.RETCD = "M";
            oReturnMsg.RTMSG = `[${sAppId}] Cordova Project 생성완료`;

            self.postMessage(oReturnMsg);

            // 최신버전의 파일 원본을 방금 생성한 폴더에 Overrite 한다.
            oAPP.onCopyOrgToCrateApp(oFormData, sRandomKey);

        });

    };

    oAPP.onStart();

};