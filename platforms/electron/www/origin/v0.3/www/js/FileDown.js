(function(o) {
    "use strict";

    o.onFileDown = function(d) {

        // Busy 실행
        oAPP.setBusy('X');

        if (o._langu === "") {
            o._langu = oAPP.onConvLangu(d["langu"]);
        }

        o.onGetFileInCache(d);

    }; // end of o.onFileDown

    o.onGetFileInCache = function(d) {

        var url = d["dataURL"],
            xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function() { // 요청에 대한 콜백
            if (xhr.readyState === xhr.DONE) { // 요청이 완료되면
                if (xhr.status === 200 || xhr.status === 201) {

                    o.onGetFileDownBlob(d, xhr.response);

                }
            }
        };

        // ajax 에러 처리
        xhr.onerror = function () {
            
            oAPP.setBusy('');

            alert(oAPP.onGetMsgTxt("0011")); /* ajax fail! */

        };

        xhr.responseType = 'blob';
        xhr.open("GET", url, true);
        xhr.send();

    }; // end of o.onGetFileInCache   

    o.onGetFileDownBlob = function(d, BLOB) {

        var folderPath = cordova.file.externalDataDirectory;
        
        // iOS 일 경우의 Folder Path
        if(device.platform.toUpperCase() == "IOS"){
            folderPath = cordova.file.cacheDirectory;
        }
        
        window.resolveLocalFileSystemURL(
            folderPath,                 // 폴더 경로
            o.getFolderSuccess.bind(d, BLOB), // 폴더 경로가 있을 경우
            o.getFolderError    // 폴더 경로가 없을 경우
        );

    }; // end of o.onGetFileDownBlob

    // 폴더 정보 구하기 성공
    o.getFolderSuccess = function(BLOB, dir){
        
        var d = this,
            filename = d["fname"];            

            dir.getFile(
                filename,                 // 파일 구하기
                { create: true },         // 옵션
                o.getFileSuccess.bind(d, BLOB), // 파일 구하기 성공
                o.getFileError    // 파일 구하기 실패  
            );
        
    }; // end of o.getFolderSuccess

    // 폴더 정보 구하기 실패
    o.getFolderError = function(err){

        oAPP.setBusy('');

        alert(oAPP.onGetMsgTxt("0012")); /* File Down Fail! */

        console.error(err);

    }; // end of o.getFolderError

    // 파일 정보 구하기 성공
    o.getFileSuccess = function(BLOB, fileEntry){
        
        var d = this;

        fileEntry.createWriter(
            o.createWriterSuccess.bind(d, BLOB, fileEntry), // fileEntry.createWriter 메소드 기능 활성화 성공
            o.createWriterError                             // fileEntry.createWriter 메소드 기능 활성화 실패
        );

    }; // end of o.getFileSuccess

    // 파일 정보 구하기 실패
    o.getFileError = function(err){

        oAPP.setBusy('');

        alert(oAPP.onGetMsgTxt("0012")); /* File Down Fail! */

        console.error(err);

    }; // end of o.getFileError

    // fileEntry.createWriter 메소드 기능 활성화 성공
    o.createWriterSuccess = function(BLOB, fileEntry, fileWriter){
        
        var d = this;

        // Blob 데이터 저장
        fileWriter.write(BLOB);
        
        // Blob 데이터 저장 성공 시
        fileWriter.onwriteend = o.onFileWriteEnd.bind(d, fileEntry);

        // Blob 데이터 저장 실패 시
        fileWriter.onerror = o.onFileWriteError;

    }; // end of o.createWriterSuccess

    // fileEntry.createWriter 메소드 기능 활성화 실패
    o.createWriterError = function(err){

        oAPP.setBusy('');

        alert(oAPP.onGetMsgTxt("0012")); /* File Down Fail! */

        console.error(err);

    }; // end of o.createWriterError

    // 파일 저장 성공 시
    o.onFileWriteEnd = function(fileEntry){

        var d = this,
            url = fileEntry.toURL(),
            mimeType = d["mime"];
        
        cordova.plugins.fileOpener2.open(
            url, 
            mimeType, 
            {
                error: o.onFileOpenerOpenError,     // 파일 열기 실패
                success: o.onFileOpenerOpenSuccess  // 파일 열기 성공
            }
        );

    }; // end of o.onFileWriteEnd

    // 파일 저장 실패 시
    o.onFileWriteError = function(err){

        oAPP.setBusy('');

        alert(oAPP.onGetMsgTxt("0012")); /* File Down Fail! */

        console.error(err);

    }; // end of o.onFileWriteError

    // 파일 열기 성공 시
    o.onFileOpenerOpenSuccess = function(){

        oAPP.setBusy('');

        console.log("success with opening the file");

    }; // end of o.onFileOpenerOpenSuccess

    // 파일 열기 실패 시
    o.onFileOpenerOpenError = function(err){

        oAPP.setBusy('');

        alert(oAPP.onGetMsgTxt("0013")); /* File Open Fail! */

        console.error(err);

    }; // end of o.onFileOpenerOpenError

})(oAPP);