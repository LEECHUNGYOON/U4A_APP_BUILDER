(function () {
    "use strict";

    /************************************************************************************************
     * Global Module..
     ************************************************************************************************/
    const
        REMOTE = require('electron').remote,
        DIALOG = REMOTE.require('electron').dialog,
        ELECTRONAPP = REMOTE.app,
        PATH = require('path'),
        IP_ADDR = require("ip"),
        SHELL = REMOTE.shell,
        FS = require('fs-extra'),
        ZIP = require("zip-lib"),
        UTIL = require(PATH.join(__dirname, "\\js\\util.js"));

    /************************************************************************************************
     * Common Variables..
     ************************************************************************************************/
    const
        TEMP_PATH = "C:\\Temp",
        U4A_BUILD_PATH = TEMP_PATH + "\\u4a_app_build",
        U4A_WWW = TEMP_PATH + "\\u4a_www",
        U4A_WWW_DBG = U4A_WWW + "\\debug",
        U4A_WWW_REL = U4A_WWW + "\\release";

    var CONNCOUNT = 0,
        oAPP = {};

    /************************************************************************************************
     * server start..
     ************************************************************************************************/
    oAPP.onStart = function () {

        var oCurrView = REMOTE.getCurrentWindow();

        // 필수 폴더 생성하기.
        var oCheck = oAPP.onCheckRequireFolder();

        if (oCheck.RETCD == "E") {

            var iBtnIndex = DIALOG.showMessageBox(oCurrView, {
                title: "Init",
                message: oCheck.MSG,
                type: "warning",
                buttons: ["재실행", "서버닫기"]

            });

            // 재실행 버튼 선택시
            if (iBtnIndex == 0) {
                location.reload();
                return;
            }

            oCurrView.close();

            return;
        }

        // WWW의 js들을 compress 한다.
        UTIL.setWWWCompress();

        const HTTP = require('http');

        var SERVER_IP = IP_ADDR.address(),
            SERVER_PORT = "9992";

        var server = HTTP.createServer();
        server.timeout = 1000000;

        server.setTimeout(1000000, () => {
            console.log('request timed out');
        });

        server.listen(SERVER_PORT, SERVER_IP, function () {
            console.log('----------- 서버 시작 ----------- : ' + SERVER_IP + ":" + SERVER_PORT);
        });

        //connection 서버에 접속한자가 누군지 안다.
        server.on('connection', function (socket) { //클라이언트 정보를 socket이 갖고있다.

            console.log('클라이언트가 접속',
                socket.remoteAddress + ',' +
                socket.remotePort);
            //socket.remoteAddress 어디서 들어왔는지 정보
            //socket.remotePort    어디서 들어왔는지 소켓의 포트번호 정보
            //외부와 통신이 되지 않을때 방화벽을 확인한다.

        });

        server.on('error', function (e) {
            console.log(e);
        });

        server.on('request', function (req, res) {

            switch (req.url) {
                case "/ping": // 서버 연결 상태 확인
                    oAPP.onPingCheck(req, res);
                    break;

                case "/getVersions": // 버전 리스트 구하기
                    oAPP.getVersionList(req, res);
                    break;

                case "/getWWWFile": // WWW 파일 전송
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

                default:
                    oAPP.onErrorPage(req, res);
                    break;

                    // res.end();
            }

        });

    }; // end of oAPP.onStart

    // WWW 파일을 compress 한다.
    oAPP.setWWWCompress = function () {







    }; // end of oAPP.setWWWCompress

    // update
    oAPP.onUpdateWWW = function (req, res) {

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

            console.log('error: ' + err);

            res.end(JSON.stringify({
                "RETCD": "E",
                "MSGTXT": err.toString()
            }));

        });

        //최종 
        FORM.parse(req, (err, fields, files) => {

            if (err) {

                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
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

    oAPP._onUpdateWWW = function (req, res, oFormData) {

        debugger;

        var oFields = oFormData["FIELDS"],
            oFiles = oFormData["FILES"];

        if (typeof oFields === "undefined") {

            res.end(JSON.stringify({
                "RETCD": "E",
                "MSGTXT": "Version 정보가 없습니다."
            }));

            return;
        }

        if (typeof oFiles === "undefined") {

            res.end(JSON.stringify({
                "RETCD": "E",
                "MSGTXT": "업데이트할 파일이 없습니다."
            }));

            return;
        }

        var sVer = oFields["VER"], // 업데이트할 버전
            oFile = oFiles["FILE"]; // 업데이트할 파일

        var sWWWFilePath = oFile.filepath;

        // Form Data에 있는 www 압축 파일을 읽는다.
        FS.readFile(sWWWFilePath, (err, data) => {

            if (err) {

                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
                }));

                return;
            }

            var sFileName = TEMP_PATH + "\\" + sVer + ".zip";

            // www 압축파일을 Temp 폴더에 저장한다.
            FS.writeFile(sFileName, data, (err) => {

                if (err) {

                    res.end(JSON.stringify({
                        "RETCD": "E",
                        "MSGTXT": err.toString()
                    }));

                    return;
                }

                var oOpt = {
                    overwrite: true
                };

                var sExtractFolderPath = TEMP_PATH + "\\" + sVer;

                // 압축 풀기
                oAPP.onExtractZipFile(req, res, sFileName, sExtractFolderPath, function () {

                    // temp -> u4a_www 폴더에 복사한다.
                    var sTargetPath = U4A_WWW + "\\" + sVer;

                    // 기존꺼 삭제한다.
                    FS.removeSync(sTargetPath);

                    FS.copy(sExtractFolderPath, sTargetPath, {
                        overwrite: true
                    }).then(function () {

                        // 압축 파일등을 삭제한다.
                        FS.removeSync(sFileName);
                        FS.removeSync(sExtractFolderPath);

                        var oRetCod = {
                            RETCD: "S",
                            MSGTXT: "업데이트 완료!"
                        };

                        res.end(JSON.stringify(oRetCod));

                    }).catch(function (err) {

                        res.end(JSON.stringify({
                            "RETCD": "E",
                            "MSGTXT": err.toString()
                        }));

                    }); // end of FS.copy

                }); // end of oAPP.onExtractZipFile

            }); // end of FS.writeFile

        }); // end of FS.readFile

    }; // end of oAPP._onUpdateWWW

    // 압축 풀기
    oAPP.onExtractZipFile = function (req, res, sSource, sTarget, fnSuccess) {

        // 압축을 푼다.
        ZIP.extract(sSource, sTarget).then(function () {

            fnSuccess();

        }).catch(function (err) {

            res.end(JSON.stringify({
                "RETCD": "E",
                "MSGTXT": err.toString()
            }));

        }); // end of ZIP.extract

    }; // end of oAPP.onExtractZipFile

    // 신규버전 생성
    oAPP.addNewVersion = function (req, res) {

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
            console.log('error: ' + err);

            res.end(JSON.stringify({
                "RETCD": "E",
                "MSGTXT": err.toString()
            }));

        });

        //최종 
        FORM.parse(req, (err, fields, files) => {

            if (err) {

                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
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
    oAPP._addNewVersion = function (res, req, oFormData) {

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

                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
                }));

                return;
            }

            // var sFileName = U4A_WWW + "\\" + sNewVer + ".zip";
            var sFileName = TEMP_PATH + "\\" + sNewVer + ".zip";

            // www 압축파일을 Temp 폴더에 저장한다.
            FS.writeFile(sFileName, data, (err) => {

                if (err) {

                    res.end(JSON.stringify({
                        "RETCD": "E",
                        "MSGTXT": err.toString()
                    }));

                    return;
                }

                var oOpt = {
                    overwrite: true
                };

                var sExtractFolderPath = TEMP_PATH + "\\" + sNewVer;

                // 압축을 푼다.
                oAPP.onExtractZipFile(req, res, sFileName, sExtractFolderPath, function () {

                    // temp -> u4a_www 폴더에 복사한다.
                    var sTargetPath = U4A_WWW + "\\" + sNewVer;
                    FS.copy(sExtractFolderPath, sTargetPath).then(function () {

                        // 압축 파일등을 삭제한다.
                        FS.removeSync(sFileName);
                        FS.removeSync(sExtractFolderPath);

                        var aFolders = FS.readdirSync(U4A_WWW);

                        var oRetCod = {
                            RETCD: "S",
                            MSGTXT: "신규버전 생성 완료!",
                            DATA: aFolders
                        };

                        res.end(JSON.stringify(oRetCod));

                    }).catch(function (err) {

                        res.end(JSON.stringify({
                            "RETCD": "E",
                            "MSGTXT": err.toString()
                        }));

                    }); // end of FS.copy

                }); // end of oAPP.onExtractZipFile

            });

        });

    }; // end of oAPP._addNewVersion

    oAPP.getLastVersion = function () {

        var aFolders = FS.readdirSync(U4A_WWW),
            iFolderLengh = aFolders.length;

        if (iFolderLengh == 0) {
            return false;
        }

        return aFolders[iFolderLengh - 1];

    };

    // 버전 리스트 구하기
    oAPP.getVersionList = function (req, res) {

        var oRetCod = {
            RETCD: "",
            MSG: ""
        };

        var aFolders = FS.readdirSync(U4A_WWW),
            iFolderLengh = aFolders.length;

        if (iFolderLengh == 0) {
            oRetCod.RETCD = "E";
            oRetCod.MSG = "버전정보가 없습니다. \n 관리자에게 문의하세요.";
            res.end(JSON.stringify(oRetCod));
            return;
        }

        oRetCod.RETCD = "S";
        oRetCod.DATA = aFolders;

        res.end(JSON.stringify(oRetCod));

    }; // end of oAPP.getVersionList

    // 서버 연결 상태 확인
    oAPP.onPingCheck = function (req, res) {

        var oRetCod = {
            RETCD: "",
            MSG: ""
        };

        oRetCod.RETCD = "S";
        oRetCod.MSG = "연결 성공!";

        res.end(JSON.stringify(oRetCod));

    }; // end of oAPP.onPingCheck

    // www 원본 파일의 마지막 버전의 파일을 보낸다.
    oAPP.getWWWFile = function (req, res) {

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
            console.log('error: ' + err);

            res.end(JSON.stringify({
                "RETCD": "E",
                "MSGTXT": err.toString()
            }));

        });

        //최종 
        FORM.parse(req, (err, fields, files) => {

            if (err) {

                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
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
    oAPP._getWWWFile = function (res, req, oFormData) {

        // TEMP_PATH = "C:\\Temp",
        // U4A_BUILD_PATH = TEMP_PATH + "\\U4A_APP_BUILD",
        // U4A_WWW = TEMP_PATH + "\\u4a_www";

        var oFields = oFormData.FIELDS,
            sVer = oFields.VER,
            sFolderPath = U4A_WWW + "\\" + sVer;

        // 해당 버전 폴더가 없으면 오류
        if (!FS.existsSync(sFolderPath)) {

            res.end(JSON.stringify({
                "RETCD": "E",
                "MSGTXT": err.toString()
            }));

            return;
        }

        const zl = require("zip-lib");

        var sFileName = sVer + ".zip",
            sTargetPath = TEMP_PATH + "\\" + sFileName;

        // www 폴더를 압축한다.
        zl.archiveFolder(sFolderPath, sTargetPath).then(function () {

            FS.readFile(sTargetPath, (err, data) => {

                if (err) {

                    console.log(err.toString());

                    res.end(JSON.stringify({
                        "RETCD": "E",
                        "MSGTXT": err.toString()
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

        }, function (err) {

            if (err) {
                console.log(err);
                console.log(err.toString());

                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
                }));

            }

        });

    }; // end of oAPP._getWWWFile

    // 복사할 original file을 c:\temp 에 복사한다.
    oAPP.onInstallOrgFiles = function (fnSuccess) {

        var FS = require('fs-extra'),
            sTmpPath = "c:\\Temp",
            isExsist = FS.existsSync(sTmpPath);

        // c:\ 에 Temp 폴더 여부 체크
        if (!isExsist) {
            FS.mkdirSync(sTmpPath);
        }

        // c:\Temp\U4A_WWW 폴더 여부 체크
        var sTmpOrgPath = U4A_WWW,
            isExsist = FS.existsSync(sTmpOrgPath);

        if (!isExsist) {
            FS.mkdirSync(sTmpOrgPath);
        }

        var sAppPath = ELECTRONAPP.getAppPath(),
            sOrgPath = PATH.join(sAppPath, "origin");

        // 원본 폴더 읽기
        FS.readdir(sOrgPath, (err, aFiles) => {

            if (err) {
                console.error(err);
                return;
            }

            var iOrgFileLength = aFiles.length;
            if (iOrgFileLength <= 0) {
                return;
            }

            var sVerPath = aFiles[iOrgFileLength - 1], // 최신 버전 폴더명                       
                sSourcePath = sOrgPath + "\\" + sVerPath; // 복사 대상 폴더 위치

            // Async with promises:
            FS.copy(sSourcePath, sTmpOrgPath).then(function () {

                console.log('origin file copy success!!');
                fnSuccess();

            }).catch(function (err) {

                console.error(err);

            }); // end of FS.copy

        }); // end of FS.readdir

    }; // end of oAPP.onInstallOrgFiles

    /************************************************************************************************
     * 필수 폴더 존재 여부 확인
     ************************************************************************************************/
    oAPP.onCheckRequireFolder = function () {

        // const
        // TEMP_PATH = "C:\\Temp",
        // U4A_BUILD_PATH = TEMP_PATH + "\\u4a_app_build",
        // U4A_WWW = TEMP_PATH + "\\u4a_www",
        // U4A_WWW_DBG = U4A_WWW + "\\debug",
        // U4A_WWW_REL = U4A_WWW + "\\release";

        var oRetCod = {
            RETCD: "",
            MSG: ""
        };

        const FS = require('fs-extra');

        // [C:\Temp]
        if (!FS.existsSync(TEMP_PATH)) {
            FS.mkdirSync(TEMP_PATH);
        }

        // [C:\Temp\u4a_app_build]
        if (!FS.existsSync(U4A_BUILD_PATH)) {
            FS.mkdirSync(U4A_BUILD_PATH);
        }

        // [C:\Temp\u4a_www]
        if (!FS.existsSync(U4A_WWW)) {
            FS.mkdirSync(U4A_WWW);
        }

        // [C:\Temp\u4a_www\debug]
        if (!FS.existsSync(U4A_WWW_DBG)) {
            FS.mkdirSync(U4A_WWW_DBG);
        }

        // [C:\Temp\u4a_www\release]
        if (!FS.existsSync(U4A_WWW_REL)) {
            FS.mkdirSync(U4A_WWW_REL);
        }

        var aFolders = FS.readdirSync(U4A_WWW_DBG),
            iFolderLengh = aFolders.length;

        if (iFolderLengh == 0) {

            // WWW 파일을 넣을 폴더를 열어준다.
            SHELL.openExternal(U4A_WWW_DBG);

            oRetCod.RETCD = "E";
            oRetCod.MSG = "WWW 파일을 넣고 재실행 해 주세요! \n 확인버튼을 누르면 재실행 됩니다 \n 경로: " + U4A_WWW_DBG;

            return oRetCod;
        }

        oRetCod.RETCD = 'S';

        return oRetCod;

    }; // end of oAPP.onCheckRequireFolder

    /************************************************************************************************
     * 앱 생성 페이지 
     ************************************************************************************************/
    oAPP.onIndexHtml = function (req, res) {

        const
            FS = require('fs-extra'),
            sAppPath = ELECTRONAPP.getAppPath(),
            sIndexHtmlUrl = PATH.join(sAppPath, "create.html");

        FS.readFile(sIndexHtmlUrl, 'utf-8', function (err, data) {

            if (err) {

                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": "create.html File Read Fail!"
                }));

                return;
            }

            res.write(data.toString());
            res.end();
            return;

        });

    }; // end of oAPP.onIndexHtml

    oAPP.onErrorPage = function (req, res) {

        const
            FS = require('fs-extra'),
            sAppPath = ELECTRONAPP.getAppPath(),
            sIndexHtmlUrl = PATH.join(sAppPath, "error.html");

        FS.readFile(sIndexHtmlUrl, 'utf-8', function (err, data) {

            if (err) {

                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": "Error File Read Fail!"
                }));

                return;
            }

            res.write(data.toString());
            res.end();
            return;

        });
    };

    oAPP.onCreateApp = function (req, res, sRandomKey) {

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
            //파일업로드 도중 장애라던지 네트워크 이상현상으로 연결이 끊길 수 있다. 
            //이 때 만약 전송중이였다면 해당 부분이 실행되면서 비동기 작업에 대한 에러를 처리한다. 
            //따로 에러에 대한 복잡한 처리없이 간단하고 효율적으로 처리할 수 있다.
            console.log('error: ' + err);

            res.end(JSON.stringify({
                "RETCD": "E",
                "MSGTXT": err.toString()
            }));

        });

        //최종 
        FORM.parse(req, (err, fields, files) => {

            if (err) {
                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
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
                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": oRet.MSG
                }));

                return;
            }

            // Random Key 구하기
            UTIL.getRandomKey(function (sRandomKey) {
                oAPP._onCreateApp(req, res, oFormData, sRandomKey);
            });

        }); // end of FORM.parse

    }; // end of oAPP.onCreateApp

    // 앱 정보 입력 체크
    oAPP.onCheckAppInfo = function (oTargetData) {

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

    oAPP._onCreateApp = function (req, res, oFormData, sRandomKey) {

        var NODECMD = require("node-cmd"),
            oFields = oFormData.FIELDS,
            sAppId = oFields.APPID,
            sFolderPath = U4A_BUILD_PATH + "\\" + sRandomKey;

        // cordova android 생성
        var sCmd = "cd c:\\";
        sCmd += " && cd " + sFolderPath;
        sCmd += " && cordova create " + sAppId + " com." + sAppId + ".app " + sAppId;

        console.log("cordova project [---" + sAppId + "---] create Start!!!");

        // NODECMD
        NODECMD.run(sCmd, function (err, data, stderr) {

            if (err) {
                console.error(err);

                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
                }));

                return;
            }

            console.log(data);

            console.log("cordova project [---" + sAppId + "---] create Finish!!!");

            // 최신버전의 파일 원본을 방금 생성한 폴더에 Overrite 한다.
            oAPP.onCopyOrgToCrateApp(req, res, oFormData, sRandomKey);

        });

    }; // end of oAPP._onCreateApp

    // 최신버전의 파일 원본을 방금 생성한 폴더에 Overrite 한다.
    oAPP.onCopyOrgToCrateApp = function (req, res, oFormData, sRandomKey) {

        const FS = require('fs-extra');

        // 원본 폴더 읽기
        FS.readdir(U4A_WWW, (err, aFiles) => {

            if (err) {
                console.error(err);

                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
                }));

                return;
            }

            var iOrgFileLength = aFiles.length;
            if (iOrgFileLength <= 0) {
                // error 처리..
                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": "복사할 파일 대상이 없습니다."
                }));

                return;
            }

            var sVerPath = aFiles[iOrgFileLength - 1], // 최신 버전 폴더명         
                oFields = oFormData.FIELDS,
                sAppId = oFields.APPID,
                sFolderPath = U4A_BUILD_PATH, // build 폴더 경로            
                sSourcePath = U4A_WWW + "\\" + sVerPath, // 복사 대상 폴더 위치
                sTargetPath = sFolderPath + "\\" + sRandomKey + "\\" + sAppId; // 붙여넣을 폴더 위치

            FS.copy(sSourcePath, sTargetPath).then(function () {

                console.log('file copy success!! -->' + sAppId);

                // index.js의 각종 파라미터들을 Replace 한다.
                oAPP.onReplaceParamToIndexJs(req, res, oFormData, sRandomKey);

            }).catch(function (err) {

                console.error(err);

                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
                }));

            });

        });

    }; // end of oAPP.onCopyOrgToCrateApp

    // index.js의 각종 파라미터들을 Replace 한다.
    oAPP.onReplaceParamToIndexJs = function (req, res, oFormData, sRandomKey) {

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

        var sBuildAppPath = U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
            sIndexJsPath = sBuildAppPath + "\\www\\js\\index.js";

        FS.readFile(sIndexJsPath, {
            encoding: "utf-8"
        }, (err, data) => {

            if (err) {
                console.error(err);
                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
                }));
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
                    console.error(err);
                    res.end(JSON.stringify({
                        "RETCD": "E",
                        "MSGTXT": err.toString()
                    }));
                    return;
                }

                FS.writeFile(sIndexJsPath, sIndexJsTxt, function (err) {

                    if (err) {
                        console.error(err);
                        res.end(JSON.stringify({
                            "RETCD": "E",
                            "MSGTXT": err.toString()
                        }));
                        return;
                    }

                    console.log("index.js write 성공! ---->" + sAppId);

                    // config.xml replace
                    oAPP.onReplaceParamToConfigXml(req, res, oFormData, sRandomKey);

                }); // end of FS.writeFile

            }); // end of FS.unlink

        }); // end of FS.readFile

    }; // end of oAPP.onReplaceParamToIndexJs

    // config xml 수정
    oAPP.onReplaceParamToConfigXml = function (req, res, oFormData, sRandomKey) {

        const FS = require('fs-extra');

        var oFields = oFormData.FIELDS,
            oFiles = oFormData.FILES,
            sAppId = oFields.APPID,
            sAppDesc = oFields.APPDESC,
            sBuildAppPath = U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
            sConfigXmlPath = sBuildAppPath + "\\config.xml",
            oReadFileOptions = {
                encoding: "utf-8"
            };

        FS.readFile(sConfigXmlPath, oReadFileOptions, (err, data) => {

            if (err) {
                console.error(err);
                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
                }));
                return;
            }

            var sXmlTextData = data;

            sXmlTextData = sXmlTextData.replace(/&PARAM1&/g, "com." + sAppId + ".app");
            sXmlTextData = sXmlTextData.replace(/&PARAM2&/g, sAppDesc);

            FS.unlink(sConfigXmlPath, (err) => {
                if (err) {
                    console.error(err);
                    res.end(JSON.stringify({
                        "RETCD": "E",
                        "MSGTXT": err.toString()
                    }));
                    return;
                }

                FS.writeFile(sConfigXmlPath, sXmlTextData, function (err) {

                    if (err) {
                        console.error(err);
                        res.end(JSON.stringify({
                            "RETCD": "E",
                            "MSGTXT": err.toString()
                        }));
                        return;
                    }

                    console.log("config.xml write 성공! ---->" + sAppId);

                    var oPromise1 = oAPP.onShortCutImageChange(oFormData, sRandomKey),
                        oPromise2 = oAPP.onIntroImageChange(oFormData, sRandomKey);

                    Promise.all([oPromise1, oPromise2]).then(() => {

                        // android platform 추가하기
                        oAPP.addPlatformAndroid(req, res, oFormData, sRandomKey);

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

                var sBuildAppPath = U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
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
                        console.log("------- ShortCut Image Write Success!" + sAppId + "-----------");
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

                var sBuildAppPath = U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
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

                        console.log("------- Intro Image Write Success!" + sAppId + "-----------");
                        resolve('X');

                    }); // end of writeFile

                });

            }); // end of FS.readFile

        });

    }; // end of oAPP.onIntroImageChange

    // android platform 추가하기
    oAPP.addPlatformAndroid = function (req, res, oFormData, sRandomKey) {

        const NODECMD = require("node-cmd");

        var oFields = oFormData.FIELDS,
            sAppId = oFields.APPID,
            sFolderPath = U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId;

        // cordova android 생성
        var sCmd = "cd c:\\";
        sCmd += " && cd " + sFolderPath;
        sCmd += " && cordova platform add android";

        console.log("cordova platform [---" + sAppId + "---] add Start!!!");

        NODECMD.run(sCmd, function (err, data, stderr) {

            if (err) {
                console.error(err);

                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
                }));

                return;
            }

            console.log(data);

            console.log("cordova platform [---" + sAppId + "---] add Finish!!!");

            // plugin 설치            
            oAPP.onInstallPlugins(req, res, oFormData, sRandomKey);

        });

    }; // end of oAPP.addPlatformAndroid

    // 플러그인 설치
    oAPP.onInstallPlugins = function (req, res, oFormData, sRandomKey) {

        const NODECMD = require("node-cmd");

        var sAppPath = ELECTRONAPP.getAppPath(),
            sConfPath = PATH.join(sAppPath, "conf") + "\\config.json",
            oFields = oFormData.FIELDS,
            sAppId = oFields.APPID,
            sBuildAppPath = U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId;

        var oConfJson = require(sConfPath),
            aPlugins = oConfJson.plugins,
            iPluginLen = aPlugins.length;

        // cordova android 생성
        var sCmd = "cd c:\\";
        sCmd += " && cd " + sBuildAppPath;

        for (var i = 0; i < iPluginLen; i++) {
            var sPlugin = aPlugins[i];

            sCmd += " && cordova plugin add " + sPlugin;
        }

        console.log("plugin Install Start. : ---->" + sAppId);

        NODECMD.run(sCmd, function (err, data, stderr) {

            if (err) {
                console.error(err);
                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
                }));
                return;
            }

            console.log(data);

            console.log("plugin Install Finish. : ---->" + sAppId);

            // app build
            oAPP.onBuildApp(req, res, oFormData, sRandomKey);
            return;

        }); // end of NODECMD.run

    }; // end of oAPP.onInstallPlugins

    // apk build
    oAPP.onBuildApp = function (req, res, oFormData, sRandomKey) {

        const NODECMD = require("node-cmd");

        // cordova android 생성
        var oFields = oFormData.FIELDS,
            sAppId = oFields.APPID,
            sBuildAppPath = U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId;

        var sCmd = "cd c:\\";
        sCmd += " && cd " + sBuildAppPath;
        sCmd += " && cordova build android";

        console.log("android app build start. ---->" + sAppId);

        NODECMD.run(sCmd, function (err, data, stderr) {

            if (err) {
                console.error(err);

                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
                }));

                return;
            }

            console.log(data);

            console.log("android app build finish. ---->" + sAppId);

            // apk 파일 response
            oAPP.onRespBuildApp(req, res, oFormData, sRandomKey);

        }); // end of NODECMD.run

    }; // end of oAPP.onBuildApp

    // Build한 Apk를 Return 한다.
    oAPP.onRespBuildApp = function (req, res, oFormData, sRandomKey) {

        const FS = require('fs-extra');

        var oFields = oFormData.FIELDS,
            sAppId = oFields.APPID,
            sBuildAppPath = U4A_BUILD_PATH + "\\" + sRandomKey + "\\" + sAppId,
            sAppPath = sBuildAppPath + "\\platforms\\android\\app\\build\\outputs\\apk\\debug\\app-debug.apk";

        console.log("apk file read start. ---->" + sAppId);

        //비동기 파일 read    
        FS.readFile(sAppPath, (err, data) => {

            if (err) {

                console.log(err.toString());

                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
                }));

                return;
            }

            // 빌드한 폴더 삭제
            // oAPP.removeBuildFolder(req, res, oFormData, sRandomKey, function () {

            console.log("apk file read success and response file. ---->" + sAppId);

            var sAppName = sAppId + ".apk";

            res.setHeader("extend", "apk"); //확장자 
            res.setHeader("fname", sAppName); //파일명 
            res.writeHead(200, {
                "Content-Type": "application/vnd.android.package-archive"
            }); //mime type

            res.write(data);
            res.end();

            console.log("--------------- apk file return!!!-- (" + sAppId + ") ----------------");

            // });

        }); // end of FS.readFile

    }; // end of oAPP.onRespBuildApp

    // 빌드한 폴더 삭제
    oAPP.removeBuildFolder = function (req, res, oFormData, sRandomKey, fnSuccess) {

        const FS = require('fs-extra');

        var oFields = oFormData.FIELDS,
            sAppId = oFields.APPID;

        var sFolderPath = U4A_BUILD_PATH + "\\" + sRandomKey;

        console.log("빌드폴더 삭제시작--- (" + sAppId + ") " + sRandomKey);

        // 폴더 삭제        
        FS.remove(sFolderPath, (err) => {

            if (err) {
                console.error(err);
                res.end(JSON.stringify({
                    "RETCD": "E",
                    "MSGTXT": err.toString()
                }));
                return;
            }

            console.log("빌드폴더 삭제 종료----> (" + sAppId + ")" + sRandomKey);

            fnSuccess();
            return;

        }); // end of FS.remove

    }; // end of oAPP.removeBuildFolder

    window.oAPP = oAPP;

})();

document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    oAPP.onStart();
}