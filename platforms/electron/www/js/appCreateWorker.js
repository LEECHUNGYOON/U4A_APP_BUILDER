self.onmessage = (oEvent) => {

    const
        PATH = require('path'),
        FS = require('fs'),
        IP_ADDR = require("ip"),
        ZIP = require("zip-lib"),
        NODECMD = require("node-cmd"),
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

        sRandomKey = oReqData.sRandomKey,
        oFields = oFormData.FIELDS,
        sAppId = oFields.APPID,
        sAppDesc = oFields.APPDESC,
        sFolderPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey;

    let oAPP = {};

    var WS = new WebSocket("ws://u4arnd.iptime.org:9401/U4A/createStatus", [sRandomKey]);

    WS.onclose = (e) => {

        oReturnMsg.RETCD = "E";
        oReturnMsg.RTMSG = e.toString();

        self.postMessage(oReturnMsg);

    };

    WS.onerror = (e) => {

        oReturnMsg.RETCD = "E";
        oReturnMsg.RTMSG = e.toString();

        self.postMessage(oReturnMsg);

    };

    WS.onopen = function (e) {

        // 빌드할때 임시로 저장할 Temp 폴더 생성
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

        // 웹소켓 메시지 전송
        oAPP.onWebSocketSend = (sMsg) => {

            var oSendData = {};

            oSendData.to_protocol = sRandomKey;
            oSendData.RTMSG = sMsg;

            WS.send(JSON.stringify(oSendData));

        };

        // 최신버전의 파일 원본을 방금 생성한 폴더에 Overrite 한다.
        oAPP.onCopyOrgToCrateApp = async function (oFormData, sRandomKey) {

            var isDbg = oFields.ISDBG,
                sWWWFolderPath = "";

            if (isDbg == "X") {
                sWWWFolderPath = PATHINFO.U4A_WWW_DBG;
            } else {
                sWWWFolderPath = PATHINFO.U4A_WWW_REL;
            }

            // 원본 폴더 읽기
            let oReadResult = await oAPP.onFsReaddir(sWWWFolderPath);
            if (oReadResult.RETCD === "E") {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = oReadResult.RTMSG;

                self.postMessage(oReturnMsg);

                // 웹소켓 종료
                oAPP.WS.close();

                return;
            }

            let aFiles = oReadResult.RTDATA;

            var iOrgFileLength = aFiles.length;
            if (iOrgFileLength <= 0) {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = "복사할 파일 대상이 없습니다.";

                self.postMessage(oReturnMsg);

                // 웹소켓 종료
                oAPP.WS.close();

                return;
            }

            var sVerPath = aFiles[iOrgFileLength - 1], // 최신 버전 폴더명                      
                sFolderPath = PATHINFO.U4A_BUILD_PATH, // build 폴더 경로            
                sSourcePath = sWWWFolderPath + "\\" + sVerPath, // 복사 대상 폴더 위치
                sTargetPath = sFolderPath + "\\" + sRandomKey + "\\" + sAppId; // 붙여넣을 폴더 위치

            // www 폴더 복사
            let oCopyResult = await oAPP.onFsCopy(sSourcePath, sTargetPath);
            if (oCopyResult.RETCD === "E") {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = oCopyResult.RTMSG;

                self.postMessage(oReturnMsg);

                // 웹소켓 종료
                oAPP.WS.close();

                return;
            }

            oReturnMsg.RETCD = "M";
            oReturnMsg.RTMSG = `[${sAppId}] WWW 폴더 복사완료`;

            self.postMessage(oReturnMsg);

            // 웹소켓 메시지 전송
            oAPP.onWebSocketSend(oReturnMsg.RTMSG);

            // index.js의 각종 파라미터들을 Replace 한다.
            oAPP.onReplaceParamToIndexJs(oFormData, sRandomKey);

        }; // end of oAPP.onCopyOrgToCrateApp       


        // 파일 읽기
        oAPP.onFSReadFile = (sPath) => {

            const FS = require('fs-extra');

            return new Promise((resolve) => {

                FS.readFile(sPath, {
                    encoding: "utf-8"
                }, (err, data) => {

                    if (err) {
                        resolve({ RETCD: "E", RTMSG: err.toString() });
                        return;
                    }

                    resolve({ RETCD: "S", RTMSG: "", RTDATA: data });

                });

            });

        }; // end of oAPP.onFSReadFile

        // 파일 삭제
        oAPP.onFsUnlink = (sPath) => {

            return new Promise((resolve) => {

                FS.unlink(sPath, (err) => {

                    if (err) {
                        resolve({ RETCD: "E", RTMSG: err.toString() });
                        return;
                    }

                    resolve({ RETCD: "S", RTMSG: "", RTDATA: "" });

                });

            });

        }; // end of oAPP.onFsUnlink

        // 파일 쓰기
        oAPP.onFsWriteFile = (sPath, sTxt) => {

            return new Promise((resolve) => {

                FS.writeFile(sPath, sTxt, function (err) {

                    if (err) {
                        resolve({ RETCD: "E", RTMSG: err.toString() });
                        return;
                    }

                    resolve({ RETCD: "S", RTMSG: "", RTDATA: "" });

                });

            });

        }; // end of oAPP.onFsWriteFile

        // index.js의 각종 파라미터들을 Replace 한다.
        oAPP.onReplaceParamToIndexJs = async function (oFormData, sRandomKey) {

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

            // index.js 파일을 읽는다.
            let oReadFileResult = await oAPP.onFSReadFile(sIndexJsPath);
            if (oReadFileResult.RETCD === "E") {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = oReadFileResult.RTMSG;

                self.postMessage(oReturnMsg);

                // 웹소켓 종료
                oAPP.WS.close();

                return;

            }

            // index.js 파일 안에 Replace 칠 부분을 수행한다.
            var sIndexJsTxt = oReadFileResult.RTDATA;

            sIndexJsTxt = sIndexJsTxt.replace(/&PARAM1&/g, oParams.PROTO);
            sIndexJsTxt = sIndexJsTxt.replace(/&PARAM2&/g, oParams.HOST);
            sIndexJsTxt = sIndexJsTxt.replace(/&PARAM3&/g, oParams.PORT);
            sIndexJsTxt = sIndexJsTxt.replace(/&PARAM4&/g, oParams.PATH);
            sIndexJsTxt = sIndexJsTxt.replace(/&PARAM5&/g, oParams.PARAM);

            // 기존 JS 파일을 삭제한다.
            let oUnlinkResult = await oAPP.onFsUnlink(sIndexJsPath);
            if (oUnlinkResult.RETCD === "E") {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = oUnlinkResult.RTMSG;

                self.postMessage(oReturnMsg);

                // 웹소켓 종료
                oAPP.WS.close();

                return;
            }

            // js 파일안에 replace 친 부분들을 다시 새로운 파일로 만든다.
            let oWriteFileResult = await oAPP.onFsWriteFile(sIndexJsPath, sIndexJsTxt);
            if (oWriteFileResult === "E") {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = oWriteFileResult.RTMSG;

                self.postMessage(oReturnMsg);

                // 웹소켓 종료
                oAPP.WS.close();

                return;

            }

            oReturnMsg.RETCD = "M";
            oReturnMsg.RTMSG = `[${sAppId}] index.js write 성공`;

            self.postMessage(oReturnMsg);

            // 웹소켓 메시지 전송
            oAPP.onWebSocketSend(oReturnMsg.RTMSG);

            // config.xml replace
            oAPP.onReplaceParamToConfigXml(oFormData, sRandomKey);

        }; // end of oAPP.onReplaceParamToIndexJs

        // config xml 수정
        oAPP.onReplaceParamToConfigXml = async function (oFormData, sRandomKey) {

            const FS = require('fs-extra');

            var sBuildAppPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
                sConfigXmlPath = sBuildAppPath + "\\config.xml",
                oReadFileOptions = {
                    encoding: "utf-8"
                };

            FS.readFile(sConfigXmlPath, oReadFileOptions, (err, data) => {

                if (err) {

                    oReturnMsg.RETCD = "E";
                    oReturnMsg.RTMSG = err.toString();

                    self.postMessage(oReturnMsg);

                    // 웹소켓 종료
                    oAPP.WS.close();

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

                        // 웹소켓 종료
                        oAPP.WS.close();

                        return;
                    }

                    FS.writeFile(sConfigXmlPath, sXmlTextData, function (err) {

                        if (err) {

                            oReturnMsg.RETCD = "E";
                            oReturnMsg.RTMSG = err.toString();

                            self.postMessage(oReturnMsg);

                            // 웹소켓 종료
                            oAPP.WS.close();

                            return;
                        }

                        oReturnMsg.RETCD = "M";
                        oReturnMsg.RTMSG = `[${sAppId}] config.xml write 성공`;

                        self.postMessage(oReturnMsg);

                        // 웹소켓 메시지 전송
                        oAPP.onWebSocketSend(oReturnMsg.RTMSG);

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

                            // 웹소켓 메시지 전송
                            oAPP.onWebSocketSend(oReturnMsg.RTMSG);

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

                            // 웹소켓 메시지 전송
                            oAPP.onWebSocketSend(oReturnMsg.RTMSG);

                            resolve('X');

                        }); // end of writeFile

                    });

                }); // end of FS.readFile

            });

        }; // end of oAPP.onIntroImageChange

        // android platform 추가하기
        oAPP.addPlatformAndroid = function (oFormData, sRandomKey) {

            var sFolderPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId;

            // cordova android 생성
            var sCmd = "cd c:\\";
            sCmd += " && cd " + sFolderPath;
            sCmd += ` && cordova platform add android@${process.env.ANDROID_LATEST_VER}`;

            oReturnMsg.RETCD = "M";
            oReturnMsg.RTMSG = `[${sAppId}] cordova platform android 설치 시작!`;

            self.postMessage(oReturnMsg);

            // 웹소켓 메시지 전송
            oAPP.onWebSocketSend(oReturnMsg.RTMSG);

            NODECMD.run(sCmd, function (err, data, stderr) {

                if (err) {

                    oReturnMsg.RETCD = "E";
                    oReturnMsg.RTMSG = err.toString();

                    self.postMessage(oReturnMsg);

                    // 웹소켓 종료
                    oAPP.WS.close();

                    return;
                }

                oReturnMsg.RETCD = "M";
                oReturnMsg.RTMSG = `[${sAppId}] cordova platform android 설치 완료!`;

                self.postMessage(oReturnMsg);

                // 웹소켓 메시지 전송
                oAPP.onWebSocketSend(oReturnMsg.RTMSG);

                oAPP.onCopyBuildExtraFile(oFormData, sRandomKey).then(() => {

                    // plugin 설치            
                    oAPP.onInstallPlugins(oFormData, sRandomKey);

                });

            });

        }; // end of oAPP.addPlatformAndroid

        // APK 난독화 옵션이 있는 build-extra.gradle 파일을 복사해서 해당 옵션을 적용시키게 만든다.
        oAPP.onCopyBuildExtraFile = function (oFormData, sRandomKey) {

            return new Promise(function (resolve, reject) {

                var sBuildExtraFileName = "build-extras.gradle",
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

                    // 웹소켓 메시지 전송
                    oAPP.onWebSocketSend(oReturnMsg.RTMSG);

                    resolve();

                }).catch(function (err) {

                    oReturnMsg.RETCD = "E";
                    oReturnMsg.RTMSG = err.toString();

                    self.postMessage(oReturnMsg);

                    // 웹소켓 종료
                    oAPP.WS.close();

                }); // end of FS.copy

            });

        }; // end of oAPP.onCopyBuildExtraFile

        // 플러그인 설치
        oAPP.onInstallPlugins = function (oFormData, sRandomKey) {

            var sPluginPath = PATHINFO.U4A_PLUG_JSON,
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

            oAPP.onWebSocketSend(oReturnMsg.RTMSG);

            NODECMD.run(sCmd, function (err, data, stderr) {

                if (err) {

                    oReturnMsg.RETCD = "E";
                    oReturnMsg.RTMSG = err.toString();

                    self.postMessage(oReturnMsg);

                    // 웹소켓 종료
                    oAPP.WS.close();

                    return;
                }

                oReturnMsg.RETCD = "M";
                oReturnMsg.RTMSG = `[${sAppId}] plugin Install 종료!`;

                self.postMessage(oReturnMsg);

                // 웹소켓 메시지 전송
                oAPP.onWebSocketSend(oReturnMsg.RTMSG);

                // app build
                oAPP.onBuildApp(oFormData, sRandomKey);

                return;

            }); // end of NODECMD.run

        }; // end of oAPP.onInstallPlugins

        // apk build
        oAPP.onBuildApp = function (oFormData, sRandomKey) {

            // cordova android 생성
            var isDbg = oFields.ISDBG,
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

            // 웹소켓 메시지 전송
            oAPP.onWebSocketSend(oReturnMsg.RTMSG);

            NODECMD.run(sCmd, function (err, data, stderr) {

                if (err) {

                    oReturnMsg.RETCD = "E";
                    oReturnMsg.RTMSG = err.toString();

                    self.postMessage(oReturnMsg);

                    // 웹소켓 종료
                    oAPP.WS.close();

                    return;
                }

                oReturnMsg.RETCD = "F";
                oReturnMsg.RTMSG = `[${sAppId}] android app 빌드 종료!`;

                oReturnMsg.sRandomKey = sRandomKey;
                oReturnMsg.oFormData = oFormData;

                self.postMessage(oReturnMsg);

                // 웹소켓 메시지 전송
                oAPP.onWebSocketSend(oReturnMsg.RTMSG);

                // 웹소켓 종료
                oAPP.WS.close();

            }); // end of NODECMD.run

        }; // end of oAPP.onBuildApp

        // 로컬에 복사한 플러그인을 삭제한다.
        oAPP.onRemovePlugins = async (oFormData, sRandomKey) => {

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
            oReturnMsg.RTMSG = `[${sAppId}] APP 설치 폴더 생성중..`;

            self.postMessage(oReturnMsg);

            // 웹소켓으로 상태 전송
            oAPP.onWebSocketSend(oReturnMsg.RTMSG);

            // temp, u4a_build 폴더를 생성
            oAPP.mkDirBuildFolder(PATHINFO.TEMP_PATH);
            oAPP.mkDirBuildFolder(PATHINFO.U4A_BUILD_PATH);

            // 앱 생성 root 폴더 생성
            if (!FS.existsSync(sFolderPath)) {
                oAPP.mkDirBuildFolder(sFolderPath);
            }

            oReturnMsg.RETCD = "M";
            oReturnMsg.RTMSG = `[${sAppId}] 플러그인 복사중...`;

            self.postMessage(oReturnMsg);

            oAPP.onWebSocketSend(oReturnMsg.RTMSG);

            // 플러그인을 서버에서 로컬로 복사한다.
            var oReturnData = await MPLUGININFO.getPlugin(PATH, FS, PATHINFO.PLUGIN_PATH, sRandomKey);
            if (oReturnData.RETCD == "E") {

                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = `[${sAppId}] 플러그인 복사중 실패!!: ` + oReturnData.RTMSG;

                self.postMessage(oReturnMsg);

                // 웹소켓 종료
                oAPP.WS.close();

                return;

            }

            oFormData.TMPDIR = oReturnData.TMPDIR;
            oFormData.T_PATH = oReturnData.T_PATH;

            // cordova android 생성
            var sCmd = "cd c:\\";
            sCmd += " && cd " + sFolderPath;
            sCmd += " && cordova create " + sAppId + " com." + sAppId + ".app " + sAppId;

            oReturnMsg.RETCD = "M";
            oReturnMsg.RTMSG = `[${sAppId}] Cordova Project 생성중`;

            self.postMessage(oReturnMsg);

            oAPP.onWebSocketSend(oReturnMsg.RTMSG);

            let oCreateProject = await oAPP.onNodeCmd(sCmd);
            if (oCreateProject.RETCD == "E") {
                oReturnMsg.RETCD = "E";
                oReturnMsg.RTMSG = `[${sAppId}] Cordova Project 생성중 오류 발생!: ` + " \n\n 내용: " + oCreateProject.RTMSG;

                self.postMessage(oReturnMsg);

                // 웹소켓 종료
                oAPP.WS.close();

                return;

            }

            oReturnMsg.RETCD = "M";
            oReturnMsg.RTMSG = `[${sAppId}] Cordova Project 생성완료`;

            self.postMessage(oReturnMsg);

            oAPP.onWebSocketSend(oReturnMsg.RTMSG);

            // 최신버전의 파일 원본을 방금 생성한 폴더에 Overrite 한다.
            oAPP.onCopyOrgToCrateApp(oFormData, sRandomKey);

        }; // end of oAPP.onStart

        // cmd 실행
        oAPP.onNodeCmd = (sCmd) => {

            return new Promise((resolve) => {

                // NODECMD
                NODECMD.run(sCmd, function (err, data, stderr) {

                    if (err) {

                        resolve({ RETCD: "E", RTMSG: err.toString() });

                        return;

                    }

                    resolve({ RETCD: "S", RTMSG: "", RTDATA: data });

                });


            });

        }; // end ofo APP.onNodeCmd

        // 파일 복사
        oAPP.onFsCopy = (sSourcePath, sTargetPath) => {

            return new Promise((resolve) => {

                const FS = require('fs-extra');

                FS.copy(sSourcePath, sTargetPath).then(function () {

                    resolve({ RETCD: "S", RTMSG: "" });

                }).catch(function (err) {

                    resolve({ RETCD: "E", RTMSG: err.toString() });

                });

            });

        }; // end of oAPP.onFsCopy

        // 파일 읽기
        oAPP.onFsReaddir = (sPath) => {

            return new Promise((resolve) => {

                const FS = require('fs-extra');

                // 원본 폴더 읽기
                FS.readdir(sPath, (err, aFiles) => {

                    if (err) {

                        resolve({ RETCD: "E", RTMSG: err.toString() });

                        return;
                    }

                    resolve({
                        RETCD: "S",
                        RTMSG: "",
                        RTDATA: aFiles
                    });

                });

            });

        }; // end of oAPP.onFsReaddir

        oAPP.onStart();

    };

    oAPP.WS = WS;

};