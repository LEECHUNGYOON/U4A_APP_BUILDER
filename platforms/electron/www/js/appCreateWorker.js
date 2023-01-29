self.onmessage = (oEvent) => {    

    const
        PATH = require('path'),
        FS = require('fs'),
        IP_ADDR = require("ip"),
        NODECMD = require("node-cmd"),
        ZIP = require("zip-lib");

    setTimeout(() => {

        debugger;

        let resData = oEvent.data;

        self.postMessage(resData.sRandomKey);

    }, 5000);

};