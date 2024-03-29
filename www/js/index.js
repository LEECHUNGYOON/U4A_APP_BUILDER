(async function() {
    "use strict";

    /************************************************************************************************
     * Global Module..
     ************************************************************************************************/
    const
        REMOTE = require('@electron/remote'),
        DIALOG = REMOTE.require('electron').dialog,
        APP = REMOTE.app,
        CURRWIN = REMOTE.getCurrentWindow(),
        WEBCON = REMOTE.getCurrentWebContents(),
        PATH = require('path'),
        IP_ADDR = require("ip"),
        SHELL = REMOTE.shell,
        FS = require('fs-extra'),
        ZIP = require("zip-lib"),
        UTIL = require(PATH.join(__dirname, "\\js\\util.js")),
        APPPATH = APP.getAppPath(),
        JS_ROOT_PATH = PATH.join(APPPATH, "js"),
        CONFPATH = PATH.join(APPPATH, "conf") + "\\config.json",
        PATHINFO = require(CONFPATH).pathInfo,
        AUTOUPDATE = require(PATH.join(JS_ROOT_PATH, "autoUpdate.js")),
        MPLUGININFO = require(PATH.join(APPPATH, "js/mobilePlugin.js")),
        TRAY = REMOTE.Tray,
        TRAYMENU = REMOTE.Menu;

    /************************************************************************************************
     * Prefix
     ***********************************************************************************************/
    process.env.SERVER_COMPUTERNAME = "U4ARNDX";
    process.env.ANDROID_LATEST_VER = "10.1.2";

    /************************************************************************************************
     * Common Variables..
     ************************************************************************************************/
    var oAPP = {};
    oAPP.aWorker = [];
    oAPP.BUSY_STATUS_TXT = ""; // Busy dialog Status Text

    /************************************************************************************************
     * INITIALIZATION
     ************************************************************************************************/
    let SERVER_IP = IP_ADDR.address(),
        SERVER_PORT = "9992";


    // 실행된 컴퓨터가 서버 컴퓨터 일 경우
    if (process.env.COMPUTERNAME == process.env.SERVER_COMPUTERNAME) {
        SERVER_PORT = "9404";
    }

    /************************************************************************
     * Auto Update Check
     ************************************************************************/
    // build 된 상태에서만 자동 업데이트 체크를 한다.
    if (APP.isPackaged) {
        await AUTOUPDATE.checkUpdate();
    }

    /************************************************************************************************
     * server start..
     ************************************************************************************************/
    oAPP.onStart = async function() {

        CURRWIN.show();

        // 필수 폴더 생성하기.
        var oCheck = await oAPP.onCheckRequireFolder();
        if (oCheck.RETCD == "E") {

            DIALOG.showMessageBox(CURRWIN, {
                title: "Init",
                message: oCheck.RTMSG,
                type: "warning",
                buttons: ["재실행", "서버닫기"]
            }).then((e) => {

                var iBtnIndex = e.response;

                // 재실행 버튼 선택시
                if (iBtnIndex == 0) {
                    location.reload();
                    return;
                }

                CURRWIN.close();

            });

            return;
        }

        // WWW의 js들을 compress 한다.
        UTIL.setWWWCompress();

        const HTTP = require('http');

        var server = HTTP.createServer();
        server.timeout = 1000000;

        server.setTimeout(1000000, (e) => {
            oAPP.writeMsg('request timed out');
        });

        server.listen(SERVER_PORT, SERVER_IP, function(e) {

            oAPP.writeMsg('----------- 서버 시작 ----------- : ' + SERVER_IP + ":" + SERVER_PORT);

            // 트레이 아이콘 생성
            oAPP.createTrayIcon();

            // 브라우저 닫기 이벤트 핸들링 
            oAPP.onAttachBeforeUnloadEvent();

            // 실행된 컴퓨터가 서버 컴퓨터 일 경우
            if (process.env.COMPUTERNAME == process.env.SERVER_COMPUTERNAME) {
                CURRWIN.hide();
            }

        });

        //connection 서버에 접속한자가 누군지 안다.
        server.on('connection', function(socket) { //클라이언트 정보를 socket이 갖고있다.

            oAPP.writeMsg('클라이언트가 접속' +
                socket.remoteAddress + ',' +
                socket.remotePort);

        });

        server.on('error', function(e) {

            oAPP.writeMsg(e);

        });

        server.on('request', function(req, res) {

            if (req.url.startsWith("/createKill")) {

                oAPP.onCreateKill(req, res);

                return;
            }

            switch (req.url) {
                case "/ping": // 서버 연결 상태 확인
                    oAPP.onPingCheck(req, res);
                    break;

                    // 앱 생성시 필요한 정보들 구하기
                    // 예) app version 정보,
                    //     plugin 정보 등.
                case "/getAppMetadata":
                    oAPP.getAppMetadata(req, res);
                    break;

                case "/setUpdatePluginList":
                    oAPP.setUpdatePluginList(req, res);
                    break;

                case "/getWWWOriginFile": // WWW 원본 파일 전송
                    oAPP.getWWWFile(req, res);
                    break;

                case "/index": // 앱 생성 HTML
                    oAPP.onIndexHtml(req, res);
                    break;

                case "/create": // 앱 생성
                    oAPP.onCreateApp(req, res);
                    break;

                case "/newver": // 신규버전 생성 
                    oAPP.addNewVersion(req, res);
                    break;

                case "/update": // 업데이트
                    oAPP.onUpdateWWW(req, res);
                    break;

                case "/restart": // 앱 재실행

                    res.end(JSON.stringify({
                        RETCD: "OK",
                    }));

                    oAPP.onAppRestart();
                    break;

                default:
                    oAPP.onErrorPage(req, res);
                    break;

            }

        });

    }; // end of oAPP.onStart

    // SSE 에서 돌고 있는 인터벌을 중지한다.
    function _SSEclearInterval() {

        if (oAPP.createInterval) {
            clearInterval(oAPP.createInterval);
            delete oAPP.createInterval;
        }

    }

    function _sendSSE(req, res) {

        let sStatus_txt = "";

        // SSE 에서 돌고 있는 인터벌을 중지한다.
        _SSEclearInterval();

        oAPP.createInterval = setInterval(() => {

            // 메시지 텍스트가 FINISH 면 인터벌 종료
            if (oAPP.BUSY_STATUS_TXT == "FINISH") {
                clearInterval(oAPP.createInterval);
                delete oAPP.createInterval;
                return;
            }

            if (oAPP.BUSY_STATUS_TXT == "") {
                return;
            }

            if (sStatus_txt !== oAPP.BUSY_STATUS_TXT) {

                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });

                res.write("data: " + oAPP.BUSY_STATUS_TXT + '\n\n');

                sStatus_txt = oAPP.BUSY_STATUS_TXT;

            }

        }, 1000);

    } // end of sendSSE

    oAPP.onFsFileRemove = (sPath) => {

        return new Promise((resolve) => {

            const FS = require("fs");

            let options = {
                force: true,
                maxRetries: 3,
                recursive: true,
                retryDelay: 500
            };

            FS.rm(sPath, options, (err) => {

                if (err) {
                    console.log(err.toString());
                }

                resolve();
            });

        });

    };

    // 워커를 죽인다.
    oAPP.onCreateKill = async (req, res) => {

        // 워커를 죽이기 위한 키를 찾는다.
        var url = require('url'),
            queryData = url.parse(req.url, true).query,
            sKey = queryData.KEY,
            sAppID = queryData.APPID,
            sIsDelete = queryData.ISDELETE;

        // 전달받은 키 값이 없다면 빠져나감.
        if (!sKey || sKey == "") {
            res.end();
            return;
        }

        // 플러그인, 빌드폴더를 삭제한다.
        oAPP.onRemovePluginBuildFolders(sKey, sIsDelete);

        if (Array.isArray(oAPP.aWorker) == false) {
            res.end();
            return;
        }

        // 수집된 워커가 있는지 확인한다.
        let aWorker = oAPP.aWorker,
            iWorkLength = aWorker.length;

        if (iWorkLength == 0) {
            res.end();
            return;
        }

        // 키값에 맞는 워커를 찾는다.
        let iFound = aWorker.findIndex(elem => elem.KEY == sKey);
        if (iFound == -1) {
            res.end();
            return;
        }

        let oWorker = aWorker[iFound].WORKER;
        if (!oWorker) {
            res.end();
            return;
        }

        // 찾은 워커를 죽인다
        oWorker.terminate();

        // 찾은 워커를 삭제한다.
        aWorker = aWorker.splice(iFound, 1);

        // response
        res.end();

        oAPP.writeMsg(`${sAppID} : 생성 종료!!`);

    }; // end of oAPP.onCreateKill


    // 플러그인, 앱 빌드 폴더 삭제
    oAPP.onRemovePluginBuildFolders = (sKey, bIsBuildFolderRemove) => {

        return new Promise(async (resolve) => {

            await oAPP.onRemovePluginFolder(sKey); // 플러그인 폴더 삭제

            if (bIsBuildFolderRemove == "X") {
                await oAPP.onRemoveAppBuildFolder(sKey); // 앱 빌드 폴더 삭제     
            }

            resolve();

        });

    }; // end of oAPP.onRemovePluginBuildFolders

    // 플러그인 폴더를 삭제한다.
    oAPP.onRemovePluginFolder = (sKey) => {

        return new Promise(async (resolve) => {

            // 플러그인이 존재 하는지 확인하고 있으면 삭제
            let sPluginFolderPath = PATHINFO.PLUGIN_PATH + "\\" + sKey;
            if (FS.existsSync(sPluginFolderPath)) {
                await oAPP.onFsFileRemove(sPluginFolderPath);
            }

            resolve();

        });

    }; // end of oAPP.onRemovePluginFolder

    // 빌드한 앱의 폴더를 삭제한다.
    oAPP.onRemoveAppBuildFolder = (sKey) => {

        return new Promise(async (resolve) => {

            // 앱 빌드 폴더도 존재 하는지 확인하고 있으면 삭제
            let sAppBuildPath = PATHINFO.U4A_BUILD_PATH + "\\" + sKey;
            if (FS.existsSync(sAppBuildPath)) {
                await oAPP.onFsFileRemove(sAppBuildPath);
            }

            resolve();

        });

    }; // end of oAPP.onRemoveAppBuildFolder

    /************************************************************************
     * 플러그인 목록 업데이트 하기  
     ************************************************************************/
    oAPP.setUpdatePluginList = function(req, res) {

        const
            FORMIDABLE = require('formidable'),
            FORM = FORMIDABLE({
                multiples: true
            });

        //클라이언트에서 파라메터 전송 data 존재하면 여길 callback
        FORM.on('field', (fieldName, fieldValue) => {
            FORM.emit('data', {
                name: 'field',
                key: fieldName,
                value: fieldValue
            });
        });

        //1.클라이언트에서 파일업로드 햇을경우 ... 시작 이벤트 
        FORM.on('fileBegin', (formname, file) => {
            FORM.emit('data', {
                name: 'file',
                formname,
                value: file
            });
        });

        //2.클라이언트에서 파일업로드 햇을경우 ... 시작 이벤트 
        FORM.on('file', (fieid, file) => {
            FORM.emit('data', {
                name: 'field',
                key: fieid,
                value: file
            });
        });

        //오류 이벤트 
        FORM.on('error', (err) => {

            oAPP.writeMsg('error: ' + err);

            // response error
            _res_error(res, JSON.stringify({
                "RETCD": "E",
                "RTMSG": err.toString()
            }));

        });

        //최종 
        FORM.parse(req, (err, fields, files) => {

            if (err) {

                // response error
                _res_error(res, JSON.stringify({
                    "RETCD": "E",
                    "RTMSG": err.toString()
                }));

                return;
            }

            var oFormData = {
                FIELDS: fields,
                FILES: files
            };

            // 업데이트           
            oAPP._setUpdatePluginList(req, res, oFormData);

        });

    }; // end of oAPP.setUpdatePluginList

    oAPP._setUpdatePluginList = function(req, res, oFormData) {

        var oFields = oFormData["FIELDS"];

        if (typeof oFields === "undefined") {

            // response error
            _res_error(res, JSON.stringify({
                "RETCD": "E",
                "RTMSG": "Plugin 정보가 없습니다."
            }));

            return;
        }

        var sEncode = oFields.PLUGIN,
            sDecode = decodeURIComponent(sEncode),
            aPlugins = JSON.parse(sDecode),
            iPluginLength = aPlugins.length;

        // 플러그인 리스트에 있는 공백 요소 제거
        for (var i = iPluginLength - 1; i >= 0; i--) {
            if (aPlugins[i] == "") {
                aPlugins.splice(i, 1);
            }
        }

        var sPluginPath = PATHINFO.U4A_PLUG_JSON,
            bIsPluginExist = FS.existsSync(sPluginPath);

        // 플러그인 파일이 없을 경우
        if (bIsPluginExist == false) {

            // response error
            _res_error(res, JSON.stringify({
                RETCD: "E",
                MSG: "Plugins.json 파일이 없습니다."
            }));

            return;
        }

        var sPluginJson = JSON.stringify(aPlugins);

        // www 압축파일을 Temp 폴더에 저장한다.
        FS.writeFile(sPluginPath, sPluginJson, (err) => {

            if (err) {

                // response error
                _res_error(res, JSON.stringify({
                    "RETCD": "E",
                    "RTMSG": err.toString()
                }));

                return;
            }

            oAPP.getAppMetadata(req, res);

        });

    }; // end of oAPP._setUpdatePluginList

    /************************************************************************
     * 앱 생성시 필요한 정보들 구하기 
     *  예) app version 정보,
     * plugin 정보 등.
     ************************************************************************/
    oAPP.getAppMetadata = function(req, res) {

        // 버전 정보 구하기.
        var oResult = oAPP.getVersionList();
        if (oResult.RETCD == 'E') {

            // response error
            _res_error(res, JSON.stringify(oResult));

            return;
        }

        // plugin 정보 구하기
        var sPluginPath = PATHINFO.U4A_PLUG_JSON,
            bIsPluginExist = FS.existsSync(sPluginPath);

        // 플러그인 파일이 없을 경우
        if (bIsPluginExist == false) {

            // response error
            _res_error(res, JSON.stringify({
                RETCD: "E",
                MSG: "Plugins.json 파일이 없습니다."
            }));

            return;
        }
        var sPluginInfo = FS.readFileSync(sPluginPath, 'utf-8');

        // 플러그인 정보, www 버전 리스트 정보를 리턴해준다.
        var aPlugins = JSON.parse(sPluginInfo),
            oAppInfo = {
                VERLIST: oResult.DATA, // Version List
                PLUGINS: aPlugins
            },
            oRetCod = {
                RETCD: "S",
                MSG: "",
                DATA: oAppInfo
            };

        res.end(JSON.stringify(oRetCod));

    }; // end of oAPP.getAppMetadata

    // update
    oAPP.onUpdateWWW = function(req, res) {

        const
            FORMIDABLE = require('formidable'),
            FORM = FORMIDABLE({
                multiples: true
            });

        //클라이언트에서 파라메터 전송 data 존재하면 여길 callback
        FORM.on('field', (fieldName, fieldValue) => {
            FORM.emit('data', {
                name: 'field',
                key: fieldName,
                value: fieldValue
            });
        });

        //1.클라이언트에서 파일업로드 햇을경우 ... 시작 이벤트 
        FORM.on('fileBegin', (formname, file) => {
            FORM.emit('data', {
                name: 'file',
                formname,
                value: file
            });
        });

        //2.클라이언트에서 파일업로드 햇을경우 ... 시작 이벤트 
        FORM.on('file', (fieid, file) => {
            FORM.emit('data', {
                name: 'field',
                key: fieid,
                value: file
            });
        });

        //오류 이벤트 
        FORM.on('error', (err) => {

            oAPP.writeMsg('error: ' + err);

            // response error
            _res_error(res, JSON.stringify({
                "RETCD": "E",
                "RTMSG": err.toString()
            }));

        });

        //최종 
        FORM.parse(req, (err, fields, files) => {

            if (err) {

                // response error
                _res_error(res, JSON.stringify({
                    "RETCD": "E",
                    "RTMSG": err.toString()
                }));

                return;
            }

            var oFormData = {
                FIELDS: fields,
                FILES: files
            };

            // 업데이트           
            oAPP._onUpdateWWW(req, res, oFormData);
        });


    }; // end of oAPP.onUpdateWWW

    oAPP._onUpdateWWW = function(req, res, oFormData) {

        var oFields = oFormData["FIELDS"],
            oFiles = oFormData["FILES"];

        if (typeof oFields === "undefined") {

            // response error
            _res_error(res, JSON.stringify({
                "RETCD": "E",
                "RTMSG": "Version 정보가 없습니다."
            }));

            return;
        }

        if (typeof oFiles === "undefined") {

            // response error
            _res_error(res, JSON.stringify({
                "RETCD": "E",
                "RTMSG": "업데이트할 파일이 없습니다."
            }));

            return;
        }

        var sVer = oFields["VER"], // 업데이트할 버전
            oFile = oFiles["FILE"]; // 업데이트할 파일

        var sWWWFilePath = oFile.filepath;

        // Form Data에 있는 www 압축 파일을 읽는다.
        FS.readFile(sWWWFilePath, (err, data) => {

            if (err) {

                // response error
                _res_error(res, JSON.stringify({
                    "RETCD": "E",
                    "RTMSG": err.toString()
                }));

                return;
            }

            var sFileName = PATHINFO.TEMP_PATH + "\\" + sVer + ".zip";

            // www 압축파일을 Temp 폴더에 저장한다.
            FS.writeFile(sFileName, data, (err) => {

                if (err) {

                    // response error
                    _res_error(res, JSON.stringify({
                        "RETCD": "E",
                        "RTMSG": err.toString()
                    }));

                    return;
                }

                var sExtractFolderPath = PATHINFO.TEMP_PATH + "\\" + sVer;

                // 압축 풀기
                oAPP.onExtractZipFile(req, res, sFileName, sExtractFolderPath, function() {

                    // temp -> PATHINFO.U4A_WWW 폴더에 복사한다.
                    var sDbgPath = PATHINFO.U4A_WWW_DBG + "\\" + sVer,
                        sRelPath = PATHINFO.U4A_WWW_REL + "\\" + sVer;

                    // debug, release 폴더에 있는 기존버전 파일을 삭제한다.
                    FS.removeSync(sDbgPath);
                    FS.removeSync(sRelPath);

                    // debug 폴더에 업데이트 버전 파일을 복사한다.
                    FS.copySync(sExtractFolderPath, sDbgPath);

                    FS.copy(sExtractFolderPath, sRelPath, {
                        overwrite: true
                    }).then(function() {

                        // 압축 파일등을 삭제한다.
                        FS.removeSync(sFileName);
                        FS.removeSync(sExtractFolderPath);

                        // 신규 버전에 따른 www 폴더 compress
                        var oRetCod = UTIL.setWWWCompressforVersion(sVer);
                        if (oRetCod.RETCD == "E") {
                            FS.removeSync(sRelPath);
                        }

                        var oRetCod = {
                            RETCD: "S",
                            RTMSG: "업데이트 완료!"
                        };

                        res.end(JSON.stringify(oRetCod));

                    }).catch(function(err) {

                        // response error
                        _res_error(res, JSON.stringify({
                            "RETCD": "E",
                            "RTMSG": err.toString()
                        }));

                    }); // end of FS.copy

                }); // end of oAPP.onExtractZipFile

            }); // end of FS.writeFile

        }); // end of FS.readFile

    }; // end of oAPP._onUpdateWWW

    // 압축 풀기
    oAPP.onExtractZipFile = function(req, res, sSource, sTarget, fnSuccess) {

        // 압축을 푼다.
        ZIP.extract(sSource, sTarget).then(function() {

            fnSuccess();

        }).catch(function(err) {

            // response error
            _res_error(res, JSON.stringify({
                "RETCD": "E",
                "RTMSG": err.toString()
            }));

        }); // end of ZIP.extract

    }; // end of oAPP.onExtractZipFile

    // 신규버전 생성
    oAPP.addNewVersion = function(req, res) {

        const
            FORMIDABLE = require('formidable'),
            FORM = FORMIDABLE({
                multiples: true
            });

        //클라이언트에서 파라메터 전송 data 존재하면 여길 callback
        FORM.on('field', (fieldName, fieldValue) => {
            FORM.emit('data', {
                name: 'field',
                key: fieldName,
                value: fieldValue
            });
        });

        //1.클라이언트에서 파일업로드 햇을경우 ... 시작 이벤트 
        FORM.on('fileBegin', (formname, file) => {
            FORM.emit('data', {
                name: 'file',
                formname,
                value: file
            });
        });

        //2.클라이언트에서 파일업로드 햇을경우 ... 시작 이벤트 
        FORM.on('file', (fieid, file) => {
            FORM.emit('data', {
                name: 'field',
                key: fieid,
                value: file
            });
        });

        //오류 이벤트 
        FORM.on('error', (err) => {

            oAPP.writeMsg('error: ' + err);

            // response error
            _res_error(res, JSON.stringify({
                "RETCD": "E",
                "RTMSG": err.toString()
            }));

        });

        //최종 
        FORM.parse(req, (err, fields, files) => {

            if (err) {

                // response error
                _res_error(res, JSON.stringify({
                    "RETCD": "E",
                    "RTMSG": err.toString()
                }));

                return;
            }

            var oFormData = {
                FIELDS: fields,
                FILES: files
            };

            // 신규버전 생성
            oAPP._addNewVersion(res, req, oFormData);

        });

    }; // end of oAPP.addNewVersion

    // 신규버전 생성
    oAPP._addNewVersion = function(res, req, oFormData) {

        // 마지막 버전을 구한다.
        var sLastVer = oAPP.getLastVersion();

        var sNewVer = "v0.1";
        if (typeof sLastVer != "boolean" && sLastVer != false) {

            var sCurrVer = sLastVer.substring(1, sLastVer.length),
                iCurrVer = parseFloat(sCurrVer),
                iNewVer = iCurrVer + 0.1;
            iNewVer = iNewVer.toFixed(1);

            sNewVer = "v" + iNewVer;

        }

        var oFiles = oFormData.FILES,
            oWWWFile = oFiles["FILE"];

        var sWWWFilePath = oWWWFile.filepath;

        // Form Data에 있는 www 압축 파일을 읽는다.
        FS.readFile(sWWWFilePath, (err, data) => {

            if (err) {

                // response error
                _res_error(res, JSON.stringify({
                    "RETCD": "E",
                    "RTMSG": err.toString()
                }));

                return;
            }

            var sFileName = PATHINFO.TEMP_PATH + "\\" + sNewVer + ".zip";

            // www 압축파일을 Temp 폴더에 저장한다.
            FS.writeFile(sFileName, data, (err) => {

                if (err) {

                    // response error
                    _res_error(res, JSON.stringify({
                        "RETCD": "E",
                        "RTMSG": err.toString()
                    }));

                    return;
                }


                var sExtractFolderPath = PATHINFO.TEMP_PATH + "\\" + sNewVer;

                // 압축을 푼다.
                oAPP.onExtractZipFile(req, res, sFileName, sExtractFolderPath, function() {

                    // 신규 추가 버전 파일을 debug 폴더에 복사한다.
                    var sDebugPath = PATHINFO.U4A_WWW_DBG + "\\" + sNewVer;
                    FS.copySync(sExtractFolderPath, sDebugPath);

                    // temp -> PATHINFO.U4A_WWW 폴더에 복사한다.
                    var sTargetPath = PATHINFO.U4A_WWW_REL + "\\" + sNewVer;
                    FS.copy(sExtractFolderPath, sTargetPath).then(function() {

                        // 압축 파일등을 삭제한다.
                        FS.removeSync(sFileName);
                        FS.removeSync(sExtractFolderPath);

                        // 신규 버전에 따른 www 폴더 compress
                        var oRetCod = UTIL.setWWWCompressforVersion(sNewVer);
                        if (oRetCod.RETCD == "E") {
                            FS.removeSync(sTargetPath);
                        }

                        var aFolders = FS.readdirSync(PATHINFO.U4A_WWW_REL);

                        var oRetCod = {
                            RETCD: "S",
                            RTMSG: "신규버전 생성 완료!",
                            DATA: aFolders
                        };

                        res.end(JSON.stringify(oRetCod));

                    }).catch(function(err) {

                        // response error
                        _res_error(res, JSON.stringify({
                            "RETCD": "E",
                            "RTMSG": err.toString()
                        }));

                    }); // end of FS.copy

                }); // end of oAPP.onExtractZipFile

            });

        });

    }; // end of oAPP._addNewVersion

    oAPP.getLastVersion = function() {

        var aFolders = FS.readdirSync(PATHINFO.U4A_WWW_DBG),
            iFolderLengh = aFolders.length;

        if (iFolderLengh == 0) {
            return false;
        }

        return aFolders[iFolderLengh - 1];

    };

    // 버전 리스트 구하기
    oAPP.getVersionList = function() {

        var oRetCod = {
            RETCD: "",
            MSG: ""
        };

        var aFolders = FS.readdirSync(PATHINFO.U4A_WWW_DBG),
            iFolderLengh = aFolders.length;

        if (iFolderLengh == 0) {
            oRetCod.RETCD = "E";
            oRetCod.MSG = "버전정보가 없습니다. \n 관리자에게 문의하세요.";
            return oRetCod;
        }

        oRetCod.RETCD = "S";
        oRetCod.DATA = aFolders;

        return oRetCod;

    }; // end of oAPP.getVersionList

    // 서버 연결 상태 확인
    oAPP.onPingCheck = function(req, res) {

        var oRetCod = {
            RETCD: "",
            MSG: ""
        };

        oRetCod.RETCD = "S";
        oRetCod.MSG = "연결 성공!";

        res.end(JSON.stringify(oRetCod));

    }; // end of oAPP.onPingCheck

    // www 원본 파일의 마지막 버전의 파일을 보낸다.
    oAPP.getWWWFile = function(req, res) {

        const
            FORMIDABLE = require('formidable'),
            FORM = FORMIDABLE({
                multiples: true
            });

        //클라이언트에서 파라메터 전송 data 존재하면 여길 callback
        FORM.on('field', (fieldName, fieldValue) => {
            FORM.emit('data', {
                name: 'field',
                key: fieldName,
                value: fieldValue
            });
        });

        //1.클라이언트에서 파일업로드 햇을경우 ... 시작 이벤트 
        FORM.on('fileBegin', (formname, file) => {
            FORM.emit('data', {
                name: 'file',
                formname,
                value: file
            });
        });

        //2.클라이언트에서 파일업로드 햇을경우 ... 시작 이벤트 
        FORM.on('file', (fieid, file) => {
            FORM.emit('data', {
                name: 'field',
                key: fieid,
                value: file
            });
        });

        //오류 이벤트 
        FORM.on('error', (err) => {
            //파일업로드 도중 장애라던지 네트워크 이상현상으로 연결이 끊길 수 있다. 
            //이 때 만약 전송중이였다면 해당 부분이 실행되면서 비동기 작업에 대한 에러를 처리한다. 
            //따로 에러에 대한 복잡한 처리없이 간단하고 효율적으로 처리할 수 있다.
            oAPP.writeMsg('error: ' + err);

            // response error
            _res_error(res, JSON.stringify({
                "RETCD": "E",
                "RTMSG": err.toString()
            }));

        });

        //최종 
        FORM.parse(req, (err, fields, files) => {

            if (err) {

                // response error
                _res_error(res, JSON.stringify({
                    "RETCD": "E",
                    "RTMSG": err.toString()
                }));

                return;
            }

            var oFormData = {
                FIELDS: fields,
                FILES: files
            };

            oAPP._getWWWFile(res, req, oFormData);

        });

    }; // end of oAPP.getWWWFile

    // WWW 파일을 구한다.
    oAPP._getWWWFile = function(res, req, oFormData) {

        var oFields = oFormData.FIELDS,
            sVer = oFields.VER,
            sFolderPath = PATHINFO.U4A_WWW_DBG + "\\" + sVer;

        // 해당 버전 폴더가 없으면 오류
        if (!FS.existsSync(sFolderPath)) {

            // response error
            _res_error(res, JSON.stringify({
                "RETCD": "E",
                "RTMSG": err.toString()
            }));

            return;
        }

        const zl = require("zip-lib");

        var sFileName = sVer + ".zip",
            sTargetPath = PATHINFO.TEMP_PATH + "\\" + sFileName;

        // www 폴더를 압축한다.
        zl.archiveFolder(sFolderPath, sTargetPath).then(function() {

            FS.readFile(sTargetPath, (err, data) => {

                if (err) {

                    oAPP.writeMsg(err.toString());

                    // response error
                    _res_error(res, JSON.stringify({
                        "RETCD": "E",
                        "RTMSG": err.toString()
                    }));

                    return;
                }

                FS.unlinkSync(sTargetPath);

                res.setHeader("extend", "zip"); //확장자 
                res.setHeader("fname", sFileName); //파일명 
                res.writeHead(200, {
                    "Content-Type": "application/octet-stream"
                }); //mime type

                res.write(data);
                res.end();

            });

        }, function(err) {

            if (err) {
                oAPP.writeMsg(err);
                oAPP.writeMsg(err.toString());

                // response error
                _res_error(res, JSON.stringify({
                    "RETCD": "E",
                    "RTMSG": err.toString()
                }));

            }

        });

    }; // end of oAPP._getWWWFile

    /************************************************************************************************
     * 필수 폴더 존재 여부 확인
     ************************************************************************************************/
    oAPP.onCheckRequireFolder = function() {

        return new Promise((resolve) => {

            var oRetCod = {
                RETCD: "",
                RTMSG: ""
            };

            const FS = require('fs-extra');

            // [C:\u4a_temp]
            if (!FS.existsSync(PATHINFO.TEMP_PATH)) {
                FS.mkdirSync(PATHINFO.TEMP_PATH);
            }

            // [C:\u4a_temp\u4a_app_build]
            if (!FS.existsSync(PATHINFO.U4A_BUILD_PATH)) {
                FS.mkdirSync(PATHINFO.U4A_BUILD_PATH);
            }

            // [C:\u4a_temp\plugins] 
            if (!FS.existsSync(PATHINFO.PLUGIN_PATH)) {
                FS.mkdirSync(PATHINFO.PLUGIN_PATH);
            }

            // [C:\u4a_temp\\U4A_WWW]
            if (!FS.existsSync(PATHINFO.U4A_WWW)) {
                FS.mkdirSync(PATHINFO.U4A_WWW);
            }

            // [C:\u4a_temp\U4A_WWW\debug]
            if (!FS.existsSync(PATHINFO.U4A_WWW_DBG)) {
                FS.mkdirSync(PATHINFO.U4A_WWW_DBG);
            }

            // [C:\u4a_temp\U4A_WWW\release]
            if (!FS.existsSync(PATHINFO.U4A_WWW_REL)) {
                FS.mkdirSync(PATHINFO.U4A_WWW_REL);
            }

            var aFolders = FS.readdirSync(PATHINFO.U4A_WWW_DBG),
                iFolderLengh = aFolders.length;

            if (iFolderLengh == 0) {

                // WWW 파일을 넣을 폴더를 열어준다.
                SHELL.openExternal(PATHINFO.U4A_WWW_DBG);

                oRetCod.RETCD = "E";
                oRetCod.RTMSG = "WWW 파일을 넣고 재실행 해 주세요! \n 확인버튼을 누르면 재실행 됩니다 \n 경로: " + PATHINFO.U4A_WWW_DBG;

                resolve(oRetCod);

                return;

            }

            oRetCod.RETCD = 'S';

            resolve(oRetCod);

            return;

        });

    }; // end of oAPP.onCheckRequireFolder

    /************************************************************************************************
     * 앱 생성 페이지 
     ************************************************************************************************/
    oAPP.onIndexHtml = async function(req, res) {

        const MPLUGININFO = require(PATH.join(APPPATH, "js/mobilePlugin.js"));

        let oResult = await MPLUGININFO.getPluginFolderPath();
        if (oResult.RETCD == "E") {

            // response error
            _res_error(res, JSON.stringify({
                "RETCD": "E",
                "RTMSG": oResult.RTMSG
            }));

            return;

        }

        // 버전 목록을 구한다.
        let aVer = oResult.RTDATA,
            iVerLength = aVer.length,
            aVerList = [];

        for (var i = 0; i < iVerLength; i++) {

            var sVer = aVer[i];

            if (sVer.endsWith("dev")) {
                continue;
            }

            aVerList.push(sVer);
        }

        // 오름차순으로 정렬
        aVerList.sort(function(a, b) {
            if (a < b) return 1;
            if (a > b) return -1;
            if (a === b) return 0;
        });

        const
            FS = require('fs-extra'),
            sAppPath = APP.getAppPath(),
            sIndexHtmlUrl = PATH.join(sAppPath, "create.html");

        FS.readFile(sIndexHtmlUrl, 'utf-8', function(err, data) {

            if (err) {

                // response error
                _res_error(res, JSON.stringify({
                    "RETCD": "E",
                    "RTMSG": "create.html File Read Fail!"
                }));

                return;
            }

            let serverurl = req.headers.host,
                sHtmlData = data;

            sHtmlData = sHtmlData.replace(/&PARAM1&/g, serverurl);
            sHtmlData = sHtmlData.replace(/&PARAM2&/g, aVerList);

            res.write(sHtmlData.toString());
            res.end();
            return;

        });

    }; // end of oAPP.onIndexHtml

    oAPP.onErrorPage = function(req, res) {

        const
            FS = require('fs-extra'),
            sAppPath = APP.getAppPath(),
            sIndexHtmlUrl = PATH.join(sAppPath, "error.html");

        FS.readFile(sIndexHtmlUrl, 'utf-8', function(err, data) {

            if (err) {

                // response error
                _res_error(res, JSON.stringify({
                    "RETCD": "E",
                    "RTMSG": "Error File Read Fail!"
                }));

                return;
            }

            res.write(data.toString());
            res.end();
            return;

        });
    };

    oAPP.onCreateApp = function(req, res) {

        if (req.method != "POST") {

            // Post 방식이 아니면 오류
            oAPP.onErrorPage(req, res);

            return;
        }

        const
            FORMIDABLE = require('formidable'),
            FORM = FORMIDABLE({
                multiples: true
            });

        //클라이언트에서 파라메터 전송 data 존재하면 여길 callback
        FORM.on('field', (fieldName, fieldValue) => {
            FORM.emit('data', {
                name: 'field',
                key: fieldName,
                value: fieldValue
            });
        });

        //1.클라이언트에서 파일업로드 햇을경우 ... 시작 이벤트 
        FORM.on('fileBegin', (formname, file) => {
            FORM.emit('data', {
                name: 'file',
                formname,
                value: file
            });
        });

        //2.클라이언트에서 파일업로드 햇을경우 ... 시작 이벤트 
        FORM.on('file', (fieid, file) => {
            FORM.emit('data', {
                name: 'field',
                key: fieid,
                value: file
            });
        });

        //오류 이벤트 
        FORM.on('error', (err) => {

            oAPP.writeMsg('error: ' + err);

            // response error
            _res_error(res, JSON.stringify({
                "RETCD": "E",
                "RTMSG": err.toString()
            }));

        });

        //최종 
        FORM.parse(req, (err, fields, files) => {

            if (err) {

                // response error
                _res_error(res, JSON.stringify({
                    "RETCD": "E",
                    "RTMSG": err.toString()
                }));

                return;
            }

            var oFormData = {
                FIELDS: fields,
                FILES: files
            };

            // 필수 파라미터 전달 여부 체크
            var oRet = oAPP.onCheckAppInfo(oFormData.FIELDS);
            if (oRet.RETCD == "E") {

                // response error
                _res_error(res, JSON.stringify({
                    "RETCD": "E",
                    "RTMSG": oRet.MSG
                }));

                return;
            }

            // // Random Key 구하기
            // UTIL.getRandomKey(function (sRandomKey) {
            //     oAPP._onCreateApp(req, res, oFormData);
            // });

            oAPP._onCreateApp(req, res, oFormData);

        }); // end of FORM.parse

    }; // end of oAPP.onCreateApp

    // 앱 정보 입력 체크
    oAPP.onCheckAppInfo = function(oTargetData) {

        /***********************************************************************************
         *  APP ID 체크
         ***********************************************************************************/
        var oRetMsg = UTIL.checkValidAppId(oTargetData['APPID']);
        if (oRetMsg.RETCD == "E") {
            return oRetMsg;
        }

        /***********************************************************************************
         *  APP Description 체크
         ***********************************************************************************/
        var oRetMsg = UTIL.checkValidAppDesc(oTargetData['APPDESC']);
        if (oRetMsg.RETCD == "E") {
            return oRetMsg;
        }

        /***********************************************************************************
         *  Protocol 체크
         ***********************************************************************************/
        var oRetMsg = UTIL.checkValidProtocol(oTargetData['PROTO']);
        if (oRetMsg.RETCD == "E") {
            return oRetMsg;
        }

        oRetMsg.RETCD = "S";

        return oRetMsg;

    }; // end of oAPP.onCheckAppInfo

    async function onWorkerMessage(req, res, oEvent, oWorker, oFormData) {

        let oResData = oEvent.data,
            FIELDS = oFormData.FIELDS,
            KEY = FIELDS.KEY;

        if (oResData.RETCD == "E") {

            oAPP.writeMsg(oResData.RTMSG);

            // response error
            _res_error(res, JSON.stringify(oResData));

            oWorker.terminate();

            await oAPP.onRemovePluginFolder(KEY); // 플러그인 폴더 삭제
            //await oAPP.onRemoveAppBuildFolder(KEY); // 앱 빌드 폴더 삭제    

            return;
        }

        if (oResData.RETCD == "M") {

            oAPP.writeMsg(oResData.RTMSG);

            return;

        }

        // Build 완료 시
        if (oResData.RETCD == "F") {

            oAPP.writeMsg(oResData.RTMSG);

            // apk 파일 response
            oAPP.onRespBuildApp(req, res, oResData.oFormData, oResData.sRandomKey);

            oWorker.terminate();

            await oAPP.onRemovePluginFolder(KEY); // 플러그인 폴더 삭제
            // await oAPP.onRemoveAppBuildFolder(KEY); // 앱 빌드 폴더 삭제    

            return;
        }

    }

    oAPP.onFsReadFile = (sIndexJsPath) => {

        return new Promise((resolve) => {

            FS.readFile(sIndexJsPath, {
                encoding: "utf-8"
            }, (err, data) => {

                if (err) {
                    resolve({
                        RETCD: "E"
                    });
                }

                resolve({
                    RETCD: "S",
                    RTDATA: data
                });


            });

        });

    };

    oAPP._onCreateApp = async function(req, res, oFormData) {

        debugger;

        var FIELDS = oFormData.FIELDS,
            FILES = oFormData.FILES,
            KEY = FIELDS.KEY;

        let oShortcut = FILES["SHORTCUT"],
            oIntro = FILES["INTRO"];

        if (oShortcut) {

            const shortcutfilePath = oShortcut.filepath;

            delete FILES.SHORTCUT;
            FILES.SHORTCUT = {};
            FILES.SHORTCUT.filepath = shortcutfilePath;

        }

        if (oIntro) {

            const introFilePath = oIntro.filepath;

            delete FILES.INTRO;
            FILES.INTRO = {};
            FILES.INTRO.filepath = introFilePath;

        }

        var oSendData = {
            APPPATH: APPPATH,
            PATHINFO: PATHINFO,
            oFormData: oFormData,
            sRandomKey: KEY
        }

        // 앱 생성 워커 실행
        let sWorkerPath = PATH.join(JS_ROOT_PATH, "appCreateWorker.js"),
            oWorker = new Worker(sWorkerPath);

        oWorker.onmessage = (oEvent) => {

            onWorkerMessage(req, res, oEvent, oWorker, oFormData);

        }; // end of oWorker.onmessage

        oWorker.onmessageerror = (event) => {

            let sMsg = `Error receiving message from worker: ${event}`;

            // response error
            _res_error(res, JSON.stringify({
                RETCD: "E",
                RTMSG: sMsg
            }));

            oWorker.terminate();

        }; // end of oWorker.onmessageerror

        oWorker.onerror = (event) => {

            let sMsg = "There is an error with your worker!";

            // response error
            _res_error(res, JSON.stringify({
                RETCD: "E",
                RTMSG: sMsg
            }));

            oWorker.terminate();

        }; // end of oWorker.onerror

        // let FIELDS = oFormData.FIELDS,
        //     KEY = FIELDS.KEY;

        // let oSendData = {
        //     APPPATH: APPPATH,
        //     PATHINFO: PATHINFO,
        //     oFormData: oFormData,
        //     sRandomKey: KEY
        // }

        oAPP.aWorker.push({
            KEY: KEY,
            WORKER: oWorker
        });

        oWorker.postMessage(oSendData);

        // return;






















        // oAPP.writeMsg("플러그인 복사중...");

        // oAPP.BUSY_STATUS_TXT = "플러그인 복사중...";

        // // 플러그인을 서버에서 로컬로 복사한다.
        // var oReturnData = await MPLUGININFO.getPlugin(REMOTE, PATH, FS, PATHINFO.PLUGIN_PATH);
        // if (oReturnData.RETCD == "E") {

        //     oAPP.writeMsg("플러그인 복사중 실패!!: " + oReturnData.RTMSG);

        //     // response error
        //     _res_error(res, JSON.stringify(oReturnData));

        //     return;
        // }

        // oFormData.TMPDIR = oReturnData.TMPDIR;
        // oFormData.T_PATH = oReturnData.T_PATH;

        // var NODECMD = require("node-cmd"),
        //     oFields = oFormData.FIELDS,
        //     sAppId = oFields.APPID,
        //     sFolderPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey;

        // // cordova android 생성
        // var sCmd = "cd c:\\";
        // sCmd += " && cd " + sFolderPath;
        // sCmd += " && cordova create " + sAppId + " com." + sAppId + ".app " + sAppId;

        // oAPP.writeMsg("cordova project [---" + sAppId + "---] create Start!!!");

        // oAPP.BUSY_STATUS_TXT = `[${sAppId}] Cordova Project 생성중`;

        // // NODECMD
        // NODECMD.run(sCmd, function (err, data, stderr) {

        //     if (err) {
        //         console.error(err);

        //         // response error
        //         _res_error(res, JSON.stringify({
        //             "RETCD": "E",
        //             "RTMSG": err.toString()
        //         }));

        //         return;
        //     }

        //     oAPP.writeMsg(data);

        //     oAPP.writeMsg("cordova project [---" + sAppId + "---] create Finish!!!");

        //     oAPP.BUSY_STATUS_TXT = `[${sAppId}] Cordova Project 생성완료`;

        //     // 최신버전의 파일 원본을 방금 생성한 폴더에 Overrite 한다.
        //     oAPP.onCopyOrgToCrateApp(req, res, oFormData, sRandomKey);

        // });

    }; // end of oAPP._onCreateApp

    // // 최신버전의 파일 원본을 방금 생성한 폴더에 Overrite 한다.
    // oAPP.onCopyOrgToCrateApp = function(req, res, oFormData, sRandomKey) {

    //     const FS = require('fs-extra');

    //     var oFields = oFormData.FIELDS,
    //         isDbg = oFields.ISDBG,
    //         sWWWFolderPath = "";

    //     if (isDbg == "X") {
    //         sWWWFolderPath = PATHINFO.U4A_WWW_DBG;
    //     } else {
    //         sWWWFolderPath = PATHINFO.U4A_WWW_REL;
    //     }

    //     // 원본 폴더 읽기
    //     FS.readdir(sWWWFolderPath, (err, aFiles) => {

    //         if (err) {
    //             console.error(err);

    //             // response error
    //             _res_error(res, JSON.stringify({
    //                 "RETCD": "E",
    //                 "RTMSG": err.toString()
    //             }));

    //             return;
    //         }

    //         var iOrgFileLength = aFiles.length;
    //         if (iOrgFileLength <= 0) {

    //             // response error
    //             _res_error(res, JSON.stringify({
    //                 "RETCD": "E",
    //                 "RTMSG": "복사할 파일 대상이 없습니다."
    //             }));

    //             return;
    //         }

    //         var sVerPath = aFiles[iOrgFileLength - 1], // 최신 버전 폴더명         
    //             oFields = oFormData.FIELDS,
    //             sAppId = oFields.APPID,
    //             sFolderPath = PATHINFO.U4A_BUILD_PATH, // build 폴더 경로            
    //             sSourcePath = sWWWFolderPath + "\\" + sVerPath, // 복사 대상 폴더 위치
    //             sTargetPath = sFolderPath + "\\" + sRandomKey + "\\" + sAppId; // 붙여넣을 폴더 위치

    //         FS.copy(sSourcePath, sTargetPath).then(function() {

    //             oAPP.writeMsg('file copy success!! -->' + sAppId);

    //             oAPP.BUSY_STATUS_TXT = `[${sAppId}] WWW 폴더 복사완료`;

    //             // index.js의 각종 파라미터들을 Replace 한다.
    //             oAPP.onReplaceParamToIndexJs(req, res, oFormData, sRandomKey);

    //         }).catch(function(err) {

    //             console.error(err);

    //             // response error
    //             _res_error(res, JSON.stringify({
    //                 "RETCD": "E",
    //                 "RTMSG": err.toString()
    //             }));

    //         });

    //     });

    // }; // end of oAPP.onCopyOrgToCrateApp

    // // index.js의 각종 파라미터들을 Replace 한다.
    // oAPP.onReplaceParamToIndexJs = function(req, res, oFormData, sRandomKey) {

    //     const FS = require('fs-extra');

    //     var oFields = oFormData.FIELDS,
    //         sAppId = oFields.APPID,
    //         oParams = {
    //             PROTO: oFields["PROTO"],
    //             HOST: oFields["HOST"],
    //             PORT: oFields["PORT"],
    //             PATH: oFields["PATH"],
    //             PARAM: oFields["PARAM"]
    //         };

    //     var sBuildAppPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
    //         sIndexJsPath = sBuildAppPath + "\\www\\js\\index.js";

    //     FS.readFile(sIndexJsPath, {
    //         encoding: "utf-8"
    //     }, (err, data) => {

    //         if (err) {

    //             console.error(err);

    //             // response error
    //             _res_error(res, JSON.stringify({
    //                 "RETCD": "E",
    //                 "RTMSG": err.toString()
    //             }));

    //             return;
    //         }

    //         var sIndexJsTxt = data;

    //         sIndexJsTxt = sIndexJsTxt.replace(/&PARAM1&/g, oParams.PROTO);
    //         sIndexJsTxt = sIndexJsTxt.replace(/&PARAM2&/g, oParams.HOST);
    //         sIndexJsTxt = sIndexJsTxt.replace(/&PARAM3&/g, oParams.PORT);
    //         sIndexJsTxt = sIndexJsTxt.replace(/&PARAM4&/g, oParams.PATH);
    //         sIndexJsTxt = sIndexJsTxt.replace(/&PARAM5&/g, oParams.PARAM);

    //         FS.unlink(sIndexJsPath, (err) => {
    //             if (err) {
    //                 console.error(err);

    //                 // response error
    //                 _res_error(res, JSON.stringify({
    //                     "RETCD": "E",
    //                     "RTMSG": err.toString()
    //                 }));

    //                 return;
    //             }

    //             FS.writeFile(sIndexJsPath, sIndexJsTxt, function(err) {

    //                 if (err) {
    //                     console.error(err);

    //                     // response error
    //                     _res_error(res, JSON.stringify({
    //                         "RETCD": "E",
    //                         "RTMSG": err.toString()
    //                     }));

    //                     return;
    //                 }

    //                 oAPP.writeMsg("index.js write 성공! ---->" + sAppId);

    //                 oAPP.BUSY_STATUS_TXT = `[${sAppId}] index.js write 성공`;

    //                 // config.xml replace
    //                 oAPP.onReplaceParamToConfigXml(req, res, oFormData, sRandomKey);

    //             }); // end of FS.writeFile

    //         }); // end of FS.unlink

    //     }); // end of FS.readFile

    // }; // end of oAPP.onReplaceParamToIndexJs

    // // config xml 수정
    // oAPP.onReplaceParamToConfigXml = function(req, res, oFormData, sRandomKey) {

    //     const FS = require('fs-extra');

    //     var oFields = oFormData.FIELDS,
    //         oFiles = oFormData.FILES,
    //         sAppId = oFields.APPID,
    //         sAppDesc = oFields.APPDESC,
    //         sBuildAppPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
    //         sConfigXmlPath = sBuildAppPath + "\\config.xml",
    //         oReadFileOptions = {
    //             encoding: "utf-8"
    //         };

    //     FS.readFile(sConfigXmlPath, oReadFileOptions, (err, data) => {

    //         if (err) {
    //             console.error(err);

    //             // response error
    //             _res_error(res, JSON.stringify({
    //                 "RETCD": "E",
    //                 "RTMSG": err.toString()
    //             }));

    //             return;
    //         }

    //         var sXmlTextData = data;

    //         sXmlTextData = sXmlTextData.replace(/&PARAM1&/g, "com." + sAppId + ".app");
    //         sXmlTextData = sXmlTextData.replace(/&PARAM2&/g, sAppDesc);

    //         FS.unlink(sConfigXmlPath, (err) => {
    //             if (err) {
    //                 console.error(err);

    //                 // response error
    //                 _res_error(res, JSON.stringify({
    //                     "RETCD": "E",
    //                     "RTMSG": err.toString()
    //                 }));

    //                 return;
    //             }

    //             FS.writeFile(sConfigXmlPath, sXmlTextData, function(err) {

    //                 if (err) {
    //                     console.error(err);

    //                     // response error
    //                     _res_error(res, JSON.stringify({
    //                         "RETCD": "E",
    //                         "RTMSG": err.toString()
    //                     }));

    //                     return;
    //                 }

    //                 oAPP.writeMsg("config.xml write 성공! ---->" + sAppId);

    //                 oAPP.BUSY_STATUS_TXT = `[${sAppId}] config.xml write 성공`;

    //                 var oPromise1 = oAPP.onShortCutImageChange(oFormData, sRandomKey),
    //                     oPromise2 = oAPP.onIntroImageChange(oFormData, sRandomKey);

    //                 Promise.all([oPromise1, oPromise2]).then(() => {

    //                     // android platform 추가하기
    //                     oAPP.addPlatformAndroid(req, res, oFormData, sRandomKey);

    //                 });

    //             }); // end of FS.writeFile

    //         }); // end of FS.unlink

    //     }); // end of FS.readFile

    // }; // end of oAPP.onReplaceParamToConfigXml

    // oAPP.onShortCutImageChange = function(oFormData, sRandomKey) {

    //     return new Promise((resolve, reject) => {

    //         const FS = require('fs-extra');

    //         var oFields = oFormData.FIELDS,
    //             oFiles = oFormData.FILES,
    //             sAppId = oFields.APPID;

    //         var oShortCutImg = oFiles["SHORTCUT"];

    //         if (!oShortCutImg) {
    //             resolve('X');
    //             return;
    //         }

    //         var sShortCutImgPath = oShortCutImg.filepath;

    //         FS.readFile(sShortCutImgPath, (err, data) => {

    //             if (err) {
    //                 resolve('X');
    //                 return;
    //             }

    //             var sBuildAppPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
    //                 sLogoImgPath = sBuildAppPath + "\\www\\img\\logo.png";

    //             FS.unlink(sLogoImgPath, function(err) {

    //                 if (err) {
    //                     resolve('X');
    //                     return;
    //                 }

    //                 FS.writeFile(sLogoImgPath, data, function(err) {

    //                     if (err) {
    //                         resolve('X');
    //                         return;
    //                     }
    //                     oAPP.writeMsg("------- ShortCut Image Write Success!" + sAppId + "-----------");

    //                     oAPP.BUSY_STATUS_TXT = `[${sAppId}] ShortCut Image write 성공`;

    //                     resolve('X');

    //                 }); // end of writeFile

    //             });

    //         }); // end of FS.readFile

    //     }); // end of Promise

    // }; // end of oAPP.onShortCutImageChange

    // oAPP.onIntroImageChange = function(oFormData, sRandomKey) {

    //     return new Promise((resolve, reject) => {

    //         const FS = require('fs-extra');

    //         var oFields = oFormData.FIELDS,
    //             oFiles = oFormData.FILES,
    //             sAppId = oFields.APPID;

    //         var oIntroImg = oFiles["INTRO"];

    //         if (!oIntroImg) {
    //             resolve('X');
    //             return;
    //         }

    //         var sIntroImgPath = oIntroImg.filepath;

    //         FS.readFile(sIntroImgPath, (err, data) => {

    //             if (err) {
    //                 resolve('X');
    //                 return;
    //             }

    //             var sBuildAppPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
    //                 sLogoImgPath = sBuildAppPath + "\\www\\img\\intro.png";

    //             FS.unlink(sLogoImgPath, function(err) {
    //                 if (err) {
    //                     resolve('X');
    //                     return;
    //                 }

    //                 FS.writeFile(sLogoImgPath, data, function(err) {

    //                     if (err) {
    //                         resolve('X');
    //                         return;
    //                     }

    //                     oAPP.writeMsg("------- Intro Image Write Success!" + sAppId + "-----------");

    //                     oAPP.BUSY_STATUS_TXT = `[${sAppId}] Intro Image Write 성공`;

    //                     resolve('X');

    //                 }); // end of writeFile

    //             });

    //         }); // end of FS.readFile

    //     });

    // }; // end of oAPP.onIntroImageChange

    // // android platform 추가하기
    // oAPP.addPlatformAndroid = function(req, res, oFormData, sRandomKey) {

    //     const NODECMD = require("node-cmd");

    //     var oFields = oFormData.FIELDS,
    //         sAppId = oFields.APPID,
    //         sFolderPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId;

    //     // cordova android 생성
    //     var sCmd = "cd c:\\";
    //     sCmd += " && cd " + sFolderPath;
    //     sCmd += ` && cordova platform add android@${process.env.ANDROID_LATEST_VER}`;

    //     oAPP.writeMsg("cordova platform [---" + sAppId + "---] add Start!!!");

    //     oAPP.BUSY_STATUS_TXT = `[${sAppId}] cordova platform android 설치 시작!`;

    //     NODECMD.run(sCmd, function(err, data, stderr) {

    //         if (err) {
    //             console.error(err);

    //             // response error
    //             _res_error(res, JSON.stringify({
    //                 "RETCD": "E",
    //                 "RTMSG": err.toString()
    //             }));

    //             return;
    //         }

    //         oAPP.writeMsg(data);

    //         oAPP.writeMsg("cordova platform [---" + sAppId + "---] add Finish!!!");

    //         oAPP.BUSY_STATUS_TXT = `[${sAppId}] cordova platform android 설치 완료!`;

    //         oAPP.onCopyBuildExtraFile(req, res, oFormData, sRandomKey).then(() => {

    //             // plugin 설치            
    //             oAPP.onInstallPlugins(req, res, oFormData, sRandomKey);

    //         });

    //     });

    // }; // end of oAPP.addPlatformAndroid

    // // APK 난독화 옵션이 있는 build-extra.gradle 파일을 복사해서 해당 옵션을 적용시키게 만든다.
    // oAPP.onCopyBuildExtraFile = function(req, res, oFormData, sRandomKey) {

    //     return new Promise(function(resolve, reject) {

    //         var oFields = oFormData.FIELDS,
    //             sAppId = oFields.APPID,
    //             sBuildExtraFileName = "build-extras.gradle",
    //             sFolderPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId + "\\platforms\\android\\app",
    //             sCopyTargetPath = PATH.join(sFolderPath, sBuildExtraFileName),
    //             isDbg = oFields.ISDBG;

    //         var sOrgBuildExtraFileFolderPath = APP.getAppPath() + "\\extra",
    //             sOrgBuildExtraFilePath = PATH.join(sOrgBuildExtraFileFolderPath, sBuildExtraFileName);

    //         // debug 모드일 경우 build-extra.gradle 파일 복사를 하지 않는다.
    //         if (isDbg == "X") {
    //             resolve();
    //             return;
    //         }

    //         FS.copy(sOrgBuildExtraFilePath, sCopyTargetPath).then(function() {

    //             oAPP.writeMsg('Build-extra.gradle 파일 복사 성공!!!! -->' + sAppId);

    //             oAPP.BUSY_STATUS_TXT = `[${sAppId}] Build-extra.gradle (난독화 적용 파일) 복사 성공!`;

    //             resolve();

    //         }).catch(function(err) {

    //             // response error
    //             _res_error(res, JSON.stringify({
    //                 "RETCD": "E",
    //                 "RTMSG": err.toString()
    //             }));

    //         }); // end of FS.copy

    //     });

    // }; // end of oAPP.onCopyBuildExtraFile

    // // 플러그인 설치
    // oAPP.onInstallPlugins = function(req, res, oFormData, sRandomKey) {

    //     const NODECMD = require("node-cmd");

    //     var sPluginPath = PATHINFO.U4A_PLUG_JSON,
    //         oFields = oFormData.FIELDS,
    //         sAppId = oFields.APPID,
    //         sBuildAppPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId;

    //     let aPluginList = oFormData.T_PATH,
    //         iPathLength = aPluginList.length;

    //     // cordova android 생성
    //     var sCmd = "cd c:\\";
    //     sCmd += " && cd " + sBuildAppPath;

    //     for (var i = 0; i < iPathLength; i++) {

    //         const sPluginPath = aPluginList[i];

    //         sCmd += " && cordova plugin add " + sPluginPath;

    //     }

    //     oAPP.writeMsg("plugin Install Start. : ---->" + sAppId);

    //     oAPP.BUSY_STATUS_TXT = `[${sAppId}] plugin Install 시작!`;

    //     NODECMD.run(sCmd, function(err, data, stderr) {

    //         if (err) {
    //             console.error(err);

    //             // response error
    //             _res_error(res, JSON.stringify({
    //                 "RETCD": "E",
    //                 "RTMSG": err.toString()
    //             }));

    //             return;
    //         }

    //         oAPP.writeMsg(data);

    //         oAPP.writeMsg("plugin Install Finish. : ---->" + sAppId);

    //         oAPP.BUSY_STATUS_TXT = `[${sAppId}] plugin Install 종료!`;

    //         // app build
    //         oAPP.onBuildApp(req, res, oFormData, sRandomKey);

    //         return;

    //     }); // end of NODECMD.run

    // }; // end of oAPP.onInstallPlugins

    // // apk build
    // oAPP.onBuildApp = function(req, res, oFormData, sRandomKey) {

    //     const NODECMD = require("node-cmd");

    //     // cordova android 생성
    //     var oFields = oFormData.FIELDS,
    //         sAppId = oFields.APPID,
    //         isDbg = oFields.ISDBG,
    //         sBuildAppPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId;

    //     var sCmd = "";

    //     if (isDbg == 'X') {
    //         sCmd = `cd c:\\ && cd ${sBuildAppPath} && cordova build android`;
    //     } else {
    //         sCmd = `cd c:\\ && cd ${sBuildAppPath} && cordova build android --release`;
    //     }

    //     oAPP.writeMsg("android app build start. ---->" + sAppId);

    //     oAPP.BUSY_STATUS_TXT = `[${sAppId}] android app 빌드 시작!`;

    //     NODECMD.run(sCmd, function(err, data, stderr) {

    //         if (err) {
    //             console.error(err);

    //             // response error
    //             _res_error(res, JSON.stringify({
    //                 "RETCD": "E",
    //                 "RTMSG": err.toString()
    //             }));

    //             return;
    //         }

    //         oAPP.writeMsg(data);

    //         oAPP.writeMsg("android app build finish. ---->" + sAppId);

    //         oAPP.BUSY_STATUS_TXT = `[${sAppId}] android app 빌드 종료!`;

    //         // apk 파일 response
    //         oAPP.onRespBuildApp(req, res, oFormData, sRandomKey);

    //     }); // end of NODECMD.run

    // }; // end of oAPP.onBuildApp

    // // Build한 Apk를 Return 한다.
    oAPP.onRespBuildApp = function(req, res, oFormData, sRandomKey) {

        const FS = require('fs-extra');

        var oFields = oFormData.FIELDS,
            isDbg = oFields.ISDBG,
            sAppId = oFields.APPID,
            sBuildAppPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
            sReleaseAppPath = sBuildAppPath + "\\platforms\\android\\app\\build\\outputs\\apk\\release\\app-release-unsigned.apk",
            sDebugAppPath = sBuildAppPath + "\\platforms\\android\\app\\build\\outputs\\apk\\debug\\app-debug.apk",
            sAppPath = "";

        if (isDbg == "X") {
            sAppPath = sDebugAppPath;
        } else {
            sAppPath = sReleaseAppPath;
        }

        oAPP.writeMsg("apk file read start. ---->" + sAppId);

        //비동기 파일 read    
        FS.readFile(sAppPath, (err, data) => {

            if (err) {

                oAPP.writeMsg(err.toString());

                // response error
                _res_error(res, JSON.stringify({
                    "RETCD": "E",
                    "RTMSG": err.toString()
                }));

                return;
            }

            // 빌드한 폴더 삭제
            // oAPP.removeBuildFolder(req, res, oFormData, sRandomKey, function () {

            oAPP.writeMsg("apk file read success and response file. ---->" + sAppId);

            var sAppName = sAppId + ".apk";

            res.setHeader("extend", "apk"); //확장자 
            res.setHeader("fname", sAppName); //파일명 
            res.writeHead(200, {
                "Content-Type": "application/vnd.android.package-archive"
            }); //mime type

            res.write(data);
            res.end();

            oAPP.writeMsg("--------------- apk file return!!!-- (" + sAppId + ") ----------------");

            // oAPP.BUSY_STATUS_TXT = "FINISH";

            // // });

            // // 로컬에 복사한 플러그인 파일을 삭제한다.
            // oAPP.onRemovePlugins(oFormData, sRandomKey);

        }); // end of FS.readFile

    }; // end of oAPP.onRespBuildApp

    // // 로컬에 복사한 플러그인을 삭제한다.
    // oAPP.onRemovePlugins = async (oFormData, sRandomKey) => {

    //     var oFields = oFormData.FIELDS,
    //         sAppId = oFields.APPID;

    //     oAPP.writeMsg("플러그인 삭제 시작 --- (" + sAppId + ") " + sRandomKey);

    //     if (!FS.existsSync(oFormData.TMPDIR)) {
    //         oAPP.writeMsg("플러그인 삭제 할게 없음!!");
    //         return;
    //     }

    //     try {

    //         await FS.remove(oFormData.TMPDIR);

    //         console.log('success!');

    //         oAPP.writeMsg("플러그인 삭제 종료!! --- (" + sAppId + ") " + sRandomKey);

    //     } catch (err) {
    //         oAPP.writeMsg("플러그인 삭제 오류!! ");
    //     }

    // }; // end of oAPP.onRemovePlugins

    // // 빌드한 폴더 삭제
    // oAPP.removeBuildFolder = function(req, res, oFormData, sRandomKey, fnSuccess) {

    //     const FS = require('fs-extra');

    //     var oFields = oFormData.FIELDS,
    //         sAppId = oFields.APPID;

    //     var sFolderPath = PATHINFO.U4A_BUILD_PATH + "\\" + sRandomKey;

    //     oAPP.writeMsg("빌드폴더 삭제시작--- (" + sAppId + ") " + sRandomKey);

    //     // 폴더 삭제        
    //     FS.remove(sFolderPath, (err) => {

    //         if (err) {
    //             console.error(err);

    //             // response error
    //             _res_error(res, JSON.stringify({
    //                 "RETCD": "E",
    //                 "RTMSG": err.toString()
    //             }));

    //             return;
    //         }

    //         oAPP.writeMsg("빌드폴더 삭제 종료----> (" + sAppId + ")" + sRandomKey);

    //         fnSuccess();
    //         return;

    //     }); // end of FS.remove

    // }; // end of oAPP.removeBuildFolder

    // 앱 빌드 과정을 화면에 뿌린다.
    oAPP.writeMsg = (sMsg) => {

        let oMsgArea = document.getElementById("msgArea");
        if (!oMsgArea) {
            return;
        }

        let oH1 = document.createElement("h1");
        oH1.innerHTML = sMsg;

        oMsgArea.appendChild(oH1);

        window.scrollTo(0, document.body.scrollHeight);

    }; // end of oAPP.writeMsg

    /************************************************************************
     * Tray Icon 생성
     ************************************************************************/
    oAPP.createTrayIcon = () => {

        let sTrayIconPath = PATH.join(APPPATH, "img", "icon.png");

        oAPP.oTray = new TRAY(sTrayIconPath);

        let aMenu = [{
            key: "exit",
            label: "종료",
            click: oAPP.TrayMenu01
        }];

        oAPP.oTrayMenu = TRAYMENU.buildFromTemplate(aMenu);
        oAPP.oTray.setToolTip("U4A ANDROID BUILDER");
        oAPP.oTray.setContextMenu(oAPP.oTrayMenu);

        oAPP.oTray.on("double-click", () => {

            let oCurrWin = REMOTE.getCurrentWindow(),
                bIsVisible = oCurrWin.isVisible(),
                bIsFocus = oCurrWin.isFocused();

            if (!bIsVisible) {
                oCurrWin.show();
            }

            if (!bIsFocus) {
                oCurrWin.focus();
            }

        });

    }; // end of oAPP.createTrayIcon

    oAPP.TrayMenu01 = () => {

        APP.exit();

    };

    /************************************************************************
     * 창 닫을때 이벤트 
     ************************************************************************/
    oAPP.onAttachBeforeUnloadEvent = () => {

        window.onbeforeunload = () => {

            let oCurrWin = REMOTE.getCurrentWindow();

            oCurrWin.hide();

            return "";

        };

    }; // end of oAPP.onAttachBeforeUnloadEvent

    /************************************************************************
     * 앱 재부팅
     ************************************************************************/
    oAPP.onAppRestart = () => {

        APP.relaunch();
        APP.exit();

    }; // end of oAPP.onAppRestart

    /************************************************************************
     * Error Response
     ************************************************************************/
    function _res_error(res, oReturn) {

        res.end(oReturn);

    } // end of _res_error

    window.oAPP = oAPP;

})().then(() => {
    oAPP.onStart();
});