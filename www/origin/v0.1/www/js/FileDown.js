(function(o){
"use strict";

    o.onFileDown = function(d){
        
        // Busy 실행
        oAPP.setBusy('X');

        if(o._langu === ""){ o._langu = oAPP.onConvLangu(d["langu"]); }
        
        var url  = d["dataURL"],
            fnam = d["fname"],
            mime = d["mime"];

        window.requestFileSystem(window.TEMPORARY, 5 * 1024 * 1024, function (fs) {
        
            console.log('file system open: ' + fs.name);
                
            // Parameters passed to getFile create a new file or return the file if it already exists.
            fs.root.getFile(fnam, { create: true, exclusive: false }, function (fileEntry) {
                
                // 파일 다운로드 시 저장 위치 팝업 띄우는 로직
                download(fileEntry, url);
        
            }, onErrorCreateFile);
        
        }, onErrorLoadFs);


        // 파일 저장할때 저장위치 팝업 물어보는 로직
        function download(fileEntry, uri) {            
            
            var fileTransfer = new FileTransfer();
            var fileURL = fileEntry.toURL();

            fileTransfer.download(
                uri,
                fileURL,
                function (entry) {

                    console.log("download complete: " + entry.toURL());
                    
                    // 파일 저장 경로 지정하는 팝업 (Plugin)
                    cordova.plugins.fileOpener2.open(                        
                        entry.toURL(),
                        mime,
                        {
                            error : function(a,b,c){ 

                                // Busy 끄기
                                oAPP.setBusy('');

                                // "0005" : "Download Error"
                                alert(oAPP.onGetMsgTxt("0005") + " : " + a.message);                                

                            },
                            success : function(a,b,c){

                                // Busy 끄기                                
                                oAPP.setBusy('');

                            }
                        }
                    );

                },
                function (error) {

                    // Busy 끄기
                    oAPP.setBusy('');

                    // "0005" : "Download Error" 
                    alert(oAPP.onGetMsgTxt("0005") + " : " + error.source); 
                    alert(oAPP.onGetMsgTxt("0005") + " : " + error.target); 
                    alert(oAPP.onGetMsgTxt("0005") + " : " + error.code);

                },

            );
            
        } // end of download

        /********* 오류 발생시 콜백 펑션들 **********/
        function onErrorCreateFile(err) {

            // Busy 끄기
            oAPP.setBusy('');

            alert(oAPP.onGetMsgTxt("0008")); // "0008" : "파일 가져오기 실패!"           

        }
        function onErrorLoadFs(err) {

            // Busy 끄기
            oAPP.setBusy('');

            alert(oAPP.onGetMsgTxt("0009")); // "0009" : "파일 시스템 실행 실패!"

        }

    };

})(oAPP);