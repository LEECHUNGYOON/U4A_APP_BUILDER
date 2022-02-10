(function(o){
    "use strict";
    
    o.onqr_barcode_scanner = function(d){
        
        var oPtion = d;
        
        if(o._langu === ""){ o._langu = oAPP.onConvLangu(d["langu"]); }
        
        // 바코드 스캔 옵션
        if(typeof oPtion["preferFrontCamera"] === "undefined"){ oPtion.preferFrontCamera = false; }
        if(typeof oPtion["showFlipCameraButton"] === "undefined"){ oPtion.showFlipCameraButton = true; }
        if(typeof oPtion["showTorchButton"] === "undefined"){ oPtion.showTorchButton = true; }
        if(typeof oPtion["torchOn"] === "undefined"){ oPtion.torchOn = false; }
        if(typeof oPtion["saveHistory"] === "undefined"){ oPtion.saveHistory = true; }
        if(typeof oPtion["prompt"] === "undefined"){ oPtion.prompt = "scan reading"; }
        if(typeof oPtion["formats"] !== "undefined"){ oPtion.formats = oPtion["formats"]; }

        cordova.plugins.barcodeScanner.scan(
            function (result) {

                var retVal = {"Result": result.text, "Format": result.format, "Cancelled": result.cancelled, "row_index": oPtion.row_index };

                var SendData = { REQCD : 'qr_barcode_scanner', RESP: retVal };

                var oFrame = document.getElementById('u4aAppiFrame');
                    oFrame.contentWindow.postMessage( SendData, '*' );

            },
            function (error) {
                alert(oAPP.onGetMsgTxt("0001")); // "0001" : "Scanning failed"
            },
            oPtion
        );
    };

})(oAPP);