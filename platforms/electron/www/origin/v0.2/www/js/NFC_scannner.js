(function(o){
    "use strict";
    
    o.onNFC_scannner = function(d){

        if(typeof nfc === "undefined"){ /*nfc 지원하지않습니다 */ alert(oAPP.onGetMsgTxt("0004")); return; }
        
        //언어 
        if(o._langu === ""){ o._langu = oAPP.onConvLangu(d["langu"]); }
        
        o.onNFC_scannner.oP = {};
        o.onNFC_scannner.oP.mime_type = d["mime_type"];
        o.onNFC_scannner.oP.row_index = d["row_index"];

        //nfc 권한 허용 여부 점검 
        nfc.enabled(function(s){   

            oAPP.onNFC_scannner.nfc_read_mime();

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

        // ideally some form of this can move to phonegap-nfc util
        oAPP.onNFC_scannner.decodePayload = function(record) {
            return nfc.bytesToString(record.payload); 
        };

        //nfc read (type:mime) 펑션
        oAPP.onNFC_scannner.nfc_read_mime = function(){

            //reading 성공시 callback 
            oAPP.onNFC_scannner.cb_DATA = function(e){
                
                var tag = e.tag;

                // Reading 값 파싱
                var vDATA = "";
                for (let i = 0; i < tag.ndefMessage.length; i++) {
                    vDATA = vDATA + oAPP.onNFC_scannner.decodePayload(tag.ndefMessage[i]) + "\n";
                    
                }
                
                // Reading 값 저장
                o.onNFC_scannner.oP.values = vDATA;

                //nfc 리딩대기 팝업 종료
                oAPP.onNFC_scannner.nfcReadyPOP(false, true);

            };

            //reading 이벤트 등록 성공시 callback
            oAPP.onNFC_scannner.cb_S = function(e){

                //nfc 리딩대기 팝업 오픈 
                oAPP.onNFC_scannner.nfcReadyPOP(true);

                //alert("event 등록성공");

            };    

            //reading 이벤트 등록 실패시 callback
            oAPP.onNFC_scannner.cb_E = function(e){                
                alert(oAPP.onGetMsgTxt("0007"));  // "0007" : "NFC Reading 이벤트 등록 실패!" 
            };

            //NFC Reading 팝업 펑션 생성 
            oAPP.onNFC_scannner.nfcReadyPOP = function(bIsDisp, bIsResult){
                
                var oModal = document.getElementById("nfc-modal-container");
                var oParent = document.getElementById("dyn_area");

                if(!oModal){

                    oParent.innerHTML = '<div id="nfc-modal-container" class="modal modal-close">' + 
                                        '<div class="modal-background"><div class="modal">' + 
                                        '<h2>NFC Ready to Scan </h2><div class="modal-loading">' + 
                                        '<div class="modal-line"></div><div class="modal-line"></div>' + 
                                        '<div class="modal-line"></div></div><div class="modal-footer">' + 
                                        '<button type="button" class="modal-cancelbtn modal-btn-default" onclick="oAPP.onNFC_scannner.nfcReadyPOP(false, false)">' + 
                                        'Cancel</button></div></div></div></div>';

                } //NFC Reading 팝업 펑션 생성 
                
                var oModal = document.getElementById("nfc-modal-container");
                var isSucc = "",
                    isCanc = "X";

                if(bIsDisp){
                    oModal.classList.remove("modal-close");
                }
                else {
                    
                    //취소 
                    oParent.removeChild(oModal);

                    // Reading 이벤트 제거 
                    nfc.removeMimeTypeListener(oAPP.onNFC_scannner.oP.mime_type, oAPP.onNFC_scannner.cb_DATA);

                    // Reading Bar를 닫을 때 Reading 성공/ 실패 여부에 따라 리턴 파라미터 구성

                    // Reading 성공일 경우 읽은 값을 리턴 파라미터에 전달
                    if(bIsResult){
                        isSucc = oAPP.onNFC_scannner.oP.values;
                        isCanc = '';
                    }

                    var retVal = {"Result": isSucc, "mime_type": oAPP.onNFC_scannner.oP.mime_type, "row_index": oAPP.onNFC_scannner.oP.row_index,"Cancelled": isCanc };

                    var SendData = { REQCD : 'NFC_scannner', RESP: retVal };
    
                    var oFrame = document.getElementById('u4aAppiFrame');
                        oFrame.contentWindow.postMessage( SendData, '*' );

                    delete oAPP.onNFC_scannner.oP;

                }

            };
            
            //nfc 리딩 이벤트 설정 
            nfc.addMimeTypeListener(oAPP.onNFC_scannner.oP.mime_type, oAPP.onNFC_scannner.cb_DATA, oAPP.onNFC_scannner.cb_S, oAPP.onNFC_scannner.cb_E); 

        };

    };

})(oAPP);