(() => {
    "use strict";

    let oAPP = {};

    oAPP.onStart = () => {

        sap.ui.getCore().attachInit(() => {


            oAPP.onInitRendering();


        });

    };

    oAPP.onInitRendering = () => {

        let oApp = new sap.m.App(),
            oPage = new sap.m.Page();

        oApp.addPage(oPage);
        oApp.placeAt("content");


    };

    document.addEventListener("DOMContentLoaded", () => {

        oAPP.onStart();

    })


})();