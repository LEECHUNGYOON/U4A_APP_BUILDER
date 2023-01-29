self.onmessage = (oEvent) => {

    const
        PATH = require('path'),
        FS = require('fs'),
        IP_ADDR = require("ip"),
        NODECMD = require("node-cmd"),
        ZIP = require("zip-lib");

    setTimeout(() => {

        let resData = oEvent.data,
            oFormData = resData.oFormData,
            appid = oFormData.FIELDS.APPID;

        let sendData = {
            key: resData.sRandomKey,
            appid: appid
        }

        self.postMessage(sendData);

    }, 5000);

};