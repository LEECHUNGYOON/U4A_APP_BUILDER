(function(o){
    "use strict";
    
    o.onNFC_write = function(d){
        
        if(typeof nfc === "undefined"){ /*nfc 지원하지않습니다 */ alert(oAPP.onGetMsgTxt("0004")); return; }
        
        //언어 
        if(o._langu === ""){ o._langu = oAPP.onConvLangu(d["langu"]); }

        o.onNFC_write.oP = {};
        o.onNFC_write.oP.mime_type = d["mime_type"];
        o.onNFC_write.oP.row_index = d["row_index"];
        o.onNFC_write.oP.values = d["values"];

        //nfc 권한 허용 여부 점검 
        nfc.enabled(function(s){   
            
            oAPP.onNFC_write.nfc_write_mime();

        }, 
        function(e){ 
            
            //nfc 권한 미 허용상태입니다 권한설정창으로 이동합니다
            alert(oAPP.onGetMsgTxt("0003"));
            
            nfc.showSettings(function(s){  
                //설정창이동 정상유무 

            },
            function(e){ 
                //권한 설정 실패 
                alert(oAPP.onGetMsgTxt("0002"));
            
            });            
    
        }); 

        oAPP.onNFC_write.nfc_write_mime = function(){

            oAPP.onNFC_write.writeTag = function (nfcEvent) {
                
                console.log("writeTag");

                var sMimeType = oAPP.onNFC_write.oP.mime_type,
                    sValue = oAPP.onNFC_write.oP.values,
                    oRecord = ndef.mimeMediaRecord(sMimeType, nfc.stringToBytes(sValue));

                nfc.write(
                    [oRecord],

                    oAPP.onNFC_write.nfcWriteSuccess,

                    oAPP.onNFC_write.nfcWriteFail
                );

            };

            oAPP.onNFC_write.onTagListenerSuccess = function (e) {
            
                // 로딩바 실행
                oAPP.onNFC_write.nfcInsertPop(true);

            };

            oAPP.onNFC_write.onTagListenerFail = function (e) {            
                
                alert(oAPP.onGetMsgTxt("0006")); //"0006" : "NFC Tag Listener Event 등록실패!"  

            };

            oAPP.onNFC_write.nfcWriteSuccess = function(e){

                // 로딩바 닫기
                oAPP.onNFC_write.nfcInsertPop(false, true);            
                    
            };

            oAPP.onNFC_write.nfcWriteFail = function(e){                
                
                alert(oAPP.onGetMsgTxt("0010"));    // "0010" : "NFC Write 실패!"

                // 로딩바 닫기
                oAPP.onNFC_write.nfcInsertPop(false, false);            
                
            };

            // NFC Insert POPUP
            oAPP.onNFC_write.nfcInsertPop = function (bIsDisp, bIsResult) {
                
                var oModal = document.getElementById("nfc-modal-container");
                var oParent = document.getElementById("dyn_area");

                if(!oModal){

                    oParent.innerHTML = '<div id="nfc-modal-container" class="modal modal-close">' + 
                                        '<div class="modal-background"><div class="modal">' + 
                                        '<h2>NFC Insert to Scan </h2><div class="modal-loading">' + 
                                        '<div class="modal-line"></div><div class="modal-line"></div>' + 
                                        '<div class="modal-line"></div></div><div class="modal-footer">' + 
                                        '<button type="button" class="modal-cancelbtn modal-btn-default" onclick="oAPP.onNFC_write.nfcInsertPop(false, false)">' + 
                                        'Cancel</button></div></div></div></div>';

                } //NFC Reading 팝업 펑션 생성 

                var oModal = document.getElementById("nfc-modal-container");
                var isSucc = "",
                    isCanc = "X";
                
                if(bIsDisp){
                    oModal.classList.remove("modal-close");
                }
                else {

                    // 취소 
                    oParent.removeChild(oModal);

                    // Write 이벤트 제거
                    nfc.removeTagDiscoveredListener(oAPP.onNFC_write.writeTag);
                    
                    // Loading Bar를 닫을 때 Write 성공/ 실패 여부에 따라 리턴 파라미터 구성

                    // Write 성공일 경우 읽은 값을 리턴 파라미터에 전달
                    if(bIsResult){
                        isSucc = 'X';
                        isCanc = '';
                    }

                    var retVal = {
                        "Result": isSucc, 
                        "mime_type": oAPP.onNFC_write.oP.mime_type,
                        "row_index": oAPP.onNFC_write.oP.row_index,
                        "Cancelled": isCanc
                    };

                    var SendData = { REQCD : 'NFC_write', RESP: retVal };
        
                    var oFrame = document.getElementById('u4aAppiFrame');
                        oFrame.contentWindow.postMessage( SendData, '*' );

                    delete oAPP.onNFC_write.oP;    

                }

            };

            nfc.addTagDiscoveredListener(oAPP.onNFC_write.writeTag, oAPP.onNFC_write.onTagListenerSuccess, oAPP.onNFC_write.onTagListenerFail);

        }; // end of oAPP.onNFC_write.nfc_write_mime

    }; // end of o.onNFC_write

})(oAPP);