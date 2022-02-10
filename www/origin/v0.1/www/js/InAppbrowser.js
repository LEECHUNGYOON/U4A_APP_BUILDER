(function (o) {

    o.onInAppbrowser = function (d) {

        var pageContentUrl = d["URL"],
            aParam = d["PARAM"],
            iParamLen = aParam.length;
            
        if (iParamLen > 0) {

            // var sServiceUrl = "http://49.236.106.96:8000/zs1?sap-user=soccerhs&sap-password=cjddbs12";

            var pageContent = '<html><head></head><body>';
            pageContent += '<form id="loginForm" action="' + pageContentUrl + '" method="post">';

            for (var i = 0; i < iParamLen; i++) {

                var oParam = aParam[i];

                pageContent += '<input type="hidden" name="' + oParam.NAME + '" value="' + oParam.VALUE + '">';

            }

            pageContent += '</form> <script type="text/javascript">document.getElementById("loginForm").submit();</script></body></html>';

            pageContentUrl = 'data:text/html;base64,' + btoa(pageContent);

        }       

        //window open 
        cordova.InAppBrowser.open(pageContentUrl, '_blank', 'hidden=no,location=no,clearsessioncache=no,clearcache=no');
      

    };

})(oAPP);