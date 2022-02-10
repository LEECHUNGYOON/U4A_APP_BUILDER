const oAPP = {

    _langu: "",
    _msgClass: {},
    _protcol: "&PARAM1&",
    _host: "&PARAM2&",
    _port: "&PARAM3&",
    _path: "&PARAM4&",
    _params: "&PARAM5&",
    _starturl: "",
    _Sessions: { "second": 0, "timeOUT": 5, "oInterval": null, "lastTime" : 0},

    onStart: function() {

        // 로딩 url 구성
        oAPP.onAppLoadUrl();

        //실행 APP pause / resume 설정 
        oAPP.onChkerSeesion();

        // 디바이스 체크
        if(device.platform.toUpperCase() == "IOS"){
            wkWebView.injectCookie(this._host, this._path);
        }

        //폰 back 버튼 막기
        document.addEventListener("backbutton", function() {}, false);

        //message Class
        this.onGetMsgClass("3");
        this.onGetMsgClass("E");

        // Main start JS

        //U4A APP 에서 요청 수신 이벤트
        window.addEventListener('message', function(e) {

            if (typeof e.data === "undefined") {
                return;
            }

            if (typeof e.data.REQCD === "undefined") {
                return;
            }

            //요청액션 동적 처리 펑션 호출 => u4a에서 요청하는 json object 정보는 반드시 (REQCD, IF_DATA) 존재해야함!!
            // REQCD: 처리액션코드및 JS 파일,펑션명으로 구성됨  IF_DATA: 요청 Data free style JSON 형태

            oAPP.onActionExcute(e.data.REQCD, e.data.IF_DATA);

        });

    },

    onChkerSeesion:function(){

        oAPP._Sessions.timeOUT = 28; //서비스 세션 TimeOut 초 

        //화면 백모드 (응용 프로그램은 배경으로 끼워 넣을 때)
        document.addEventListener("pause", function(){
            
            oAPP._Sessions.lastTime = new Date().getTime();

        }, false);

        //화면 활성 (응용 프로그램이 배경에서 검색 될 때 발생)
        document.addEventListener("resume", function(){
            
            var iLastTime = oAPP._Sessions.lastTime;

            if(!iLastTime){
                return;
            }

            var iCurrTime = new Date().getTime();

            var iDeffTime = (iCurrTime - iLastTime) / 1000 / 60;

            if(oAPP._Sessions.timeOUT <= iDeffTime){                
                document.getElementById("u4aAppiFrame").src = oAPP._starturl;
            }

        }, false);        

    },

    ontest: function() {


    }, //ontest

    onAppLoadUrl: function() {

        if (oAPP._starturl !== "") {
            return;
        }

        oAPP._starturl = oAPP.getStartUrlPath();        

    },

    getStartUrlPath : function(){

        var sUrl = "";

        if (oAPP._port !== "") {

            sUrl = oAPP._protcol + "://" +
                   oAPP._host + ":" +
                   oAPP._port + 
                   oAPP._path;

            sUrl = oAPP._params !== "" ? sUrl + "?" + oAPP._params : sUrl;  

            return sUrl;

        } 

        sUrl = oAPP._protcol + "://" +
               oAPP._host + 
               oAPP._path;

        sUrl = oAPP._params !== "" ? sUrl + "?" + oAPP._params : sUrl;

        return sUrl;

    },
    onActionExcute: function(actnm, if_data) {

        //--*[공통] 요청액션 처리에 펑션을 생성 처리후 실행
        //--*       js 폴더안에 처리 예:xxxx.js 파일이 존재해야함!!
        //--*       actnm <- 파라메터명은 js 파일명이여야함!!

        //전달받은 액션명으로 (on + actnm) 펑션명 구성됨!!
        var fm = "on" + actnm;

        if (typeof oAPP[fm] !== "undefined") {
            oAPP[fm](if_data);
            return;
        }

        //처음 요청일 경우는 해당 처리에 대한 js파일을 호출함
        var jsnm = "js/" + actnm + ".js";

        // alert();

        oAPP.onLoadJS(jsnm, function() {
            oAPP[fm](if_data);
        }, false);

    }, //end onActionExcute

    onLoadJS: function(u, cb, aSync) {

        //js file load
        var oJS = document.createElement('script');
        oJS.src = u;
        oJS.async = aSync;
        oJS.onload = cb;
        oJS.onreadystatechange = cb;

        document.body.appendChild(oJS);

        oJS = null;

    }, //end onLoadJS

    onCopyJSON: function(j) {

        var Ljson = JSON.stringify(j);

        return JSON.parse(Ljson);

    }, //end  onCopyJSON

    hex_to_ascii: function(str1) {

        var hex = str1.toString();
        var str = '';

        for (var n = 0; n < hex.length; n += 2) {
            str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
        }

        return str;

    }, //end hex_to_ascii

    onGetMsgClass: function(lng) {

        var langu = this.onConvLangu(lng),
            oHttp = new XMLHttpRequest();

        oHttp.onreadystatechange = function() {

            if (this.readyState == 4 && this.status == 200) {
                oAPP._msgClass[langu] = JSON.parse(this.responseText);
            }

        };

        var Lurl = "msg/" + langu + ".json";

        oHttp.open("GET", Lurl, true);

        oHttp.send();

    }, //onGetMsgClass

    onGetMsgTxt: function(cod) {
        return oAPP._msgClass[oAPP._langu][cod];
    }, //onGetMsgTxt

    onConvLangu: function(lng) {

        //sap Langu key to external key
        var Lan = "";
        switch (lng) {

            case "E":
                Lan = "EN";
                break;

            case "3":
                Lan = "KO";
                break;

            default:
                Lan = "EN";
                break;

        }

        return Lan;

    }, //onConvLangu

    // Busy Indicator
    setBusy: function(bIsBusy) {

        var oBusy = document.getElementById("u4aWsBusyIndicator");

        if (!oBusy) {
            return;
        }

        if (bIsBusy == 'X') {

            // 커서를 해제 시킨다.
            oAPP.onFocusout();

            oBusy.style.visibility = "visible";

        } else {

            oBusy.style.visibility = "hidden";

        }
    },

    // 마우스 포커스 해제 하는 펑션
    onFocusout: function() {

        document.getElementById("u4amainBody").focus();

        // var oFrame = document.getElementById("u4aAppiFrame");
        // if (!oFrame) {
        //     return;
        // }
        // var oActElem = oFrame.contentWindow.document.activeElement;
        // if (!oActElem) {
        //     return;
        // }
        // oActElem.blur();

    },
};

// Device ready
document.addEventListener('deviceready', onDeviceReady, false);

// Network Connect Event
document.addEventListener("online", onNetWorkOnline, false);
document.addEventListener("offline", onNetWorkOffline, false);

//=== DeviceReady ====

function onDeviceReady() {
    oAPP.onStart();
}

function showNetworkDisconnBlock(bIsShow) {

    var oLoadPg = document.getElementById("u4a_neterr");
    if (!oLoadPg) {
        return;
    }

    if (bIsShow == 'X') {
        // 키패드가 올라와 있을 경우 포커스 해제 하여 키패드 내리기

        oAPP.onFocusout();

        oLoadPg.classList.remove("u4a_loadersInactive");

    } else {

        oLoadPg.classList.add("u4a_loadersInactive");

    }

} // end of showNetworkDisconnBlock

function onNetWorkOnline() {

    // 로딩 url 구성
    oAPP.onAppLoadUrl();

    // 장막을 해제 한다.
    showNetworkDisconnBlock('');

    var oFrame = document.getElementById("u4aAppiFrame");

    // 초기 로드 했는지 여부 체크

    var isInitLoad = oFrame.getAttribute("data-init-load");

    if (isInitLoad == 'X') {
        return;
    }

    // 로드할 URL
    var sLoadUrl = oAPP._starturl;

    oFrame.setAttribute("data-init-load", "X");

    var oForm = document.getElementById('u4asendform');

    // 파라미터 전송 필요 시 FORM 안에 hidden field 생성
    oForm.action = sLoadUrl;
    oForm.target = "u4aAppiFrame";
    oForm.submit();

} // end of onNetWorkOnline

function onNetWorkOffline() {

    // 장막을 펼친다.
    showNetworkDisconnBlock('X');

} // end of onNetWorkOffline