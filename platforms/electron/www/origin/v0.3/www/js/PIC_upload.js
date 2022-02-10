(function(o){
    "use strict";
    
    o.onPIC_upload = function(d){

        //언어 
        if(o._langu === ""){ o._langu = oAPP.onConvLangu(d["langu"]); }

        navigator.camera.getPicture(
            function(path){ 
             
                window.resolveLocalFileSystemURL(path, function(fileEntry){

                    fileEntry.file(function (file) {
                        
                        // 옵션 기준별, 파일 체크
                        var oChkResult = lf_fileOptionCheck(d, file);

                        if(oChkResult){
                         
                            // 오류 내용 데이터 전송
                            lf_sendData(oChkResult);                          
                            
                            return;

                        }

                        // 파일 이름 구하기
                        var sFileName = file.name,
                            sMimeType = file.type;

                        var reader = new FileReader();

                        reader.onloadend = function() {

                            var oBlob = new Blob([this.result], { type: sMimeType }),
                                retVal = {"content": oBlob, "name": sFileName };

                            // 데이터 전송
                            lf_sendData(retVal);
                            
                        };
                        
                        reader.readAsArrayBuffer(file);
    
                    }, 
                    function(){
                        
                        var retVal = {
                            "Result" : '',
                            "Cancelled" : 'X' 
                        };
                        
                        // 데이터 전송
                        lf_sendData(retVal);

                    });
                
                });
            
            },

            /*
             * 1. 카메라 열고 안찍고 취소 할 경우.
             * 2. 카메라 권한 허용하지 않았을 경우
             */
            function(message) {                 
                
                var retVal = {
                    "Result" : '',                     
                    "Cancelled" : 'X' 
                };

                // 데이터 전송
                lf_sendData(retVal);

                // 카메라 권한 허용 하지 않았을 경우.
                if(message == 20){

                    //권한 설정 실패 
                    alert(oAPP.onGetMsgTxt("0002"));
                    return;

                }

            },
            {
                quality         : 50,
                destinationType : Camera.DestinationType.FILE_URI,
                sourceType      : Camera.PictureSourceType.CAMERA,
                //sourceType      : navigator.camera.PictureSourceType.PHOTOLIBRARY
            }

        );

    };

    function lf_fileOptionCheck(option, oFile){
   
        var sFileName = oFile.name,     // 파일명
            sMimeType = oFile.type,     // Mime Type
            iFileSize = oFile.size;     // 파일 사이즈 

        /*************************
         *  파일명 길이 체크
         *************************/
        if(option.maxFileLen != ""){

            var aSplit1 = sFileName.split("."),
                sFilenm = aSplit1[0],
                iFileLen = sFilenm.length;

            if(option.maxFileLen < iFileLen){
                return { erFunc : "fireFilenameLengthExceed" };
            }

        }

        /*************************
         *  파일 타입 체크
         *************************/
        var aSplit1 = sFileName.split("."),
            sExt = aSplit1[aSplit1.length - 1]; // 확장자 구하기

        var aFileType = option.fileType,        // 허용되는 파일 타입
            iFileTypeLenth = aFileType.length,

            bIsFileTypeErr = true;              // error 유무 flag

        if(iFileTypeLenth == 0){
            bIsFileTypeErr = false;
        }
        else {

            for(var i = 0; i < iFileTypeLenth; i++){

                var sFileType = aFileType[i];

                if(sExt == sFileType){
                    bIsFileTypeErr = false;
                    break;
                }

            }
        }

        // File Type Error 가 있으면 리턴
        if(bIsFileTypeErr){
            return { erFunc : "fireTypeMissmatch" };
        }

        /*************************
         *  마임타입 체크
         *************************/
        var aMimeType = option.mimeType,            // 허용되는 마임 타입
            iMimeTypeLenth = option.mimeType.length;

        var bIsMimeTypeErr = true;      // error 유무 flag

        if(iMimeTypeLenth == 0){
            bIsMimeTypeErr = false;
        }
        else {
            
            for(var i = 0; i < iMimeTypeLenth; i++){

                var allowMime = aMimeType[i];

                if(sMimeType == allowMime){
                    bIsMimeTypeErr = false;
                    break;
                }
                
            }

        }    
        
        // error 가 있으면 리턴
        if(bIsMimeTypeErr){
            return { erFunc : "fireTypeMissmatch" };            
        }

        /*************************
         *  파일 사이즈 체크
         *************************/
        if(option.maxFileSize != ""){

            // 허용되는 사이즈 값을 byte로 변환하여 계산
            var iMaxSize =  parseFloat(option.maxFileSize) * Math.pow(2,20);

                iMaxSize = Math.ceil(iMaxSize); // 소숫점 반올림

            if(iMaxSize < iFileSize){                
                return { erFunc : "fireFileSizeExceed" };
            }

        }

        return false;

    } // end of lf_fileOptionCheck

    function lf_sendData(oSendData){

        var SendData = { REQCD : 'PIC_upload', RESP: oSendData };

        var oFrame = document.getElementById('u4aAppiFrame');
            oFrame.contentWindow.postMessage( SendData, '*' );

    }

})(oAPP);