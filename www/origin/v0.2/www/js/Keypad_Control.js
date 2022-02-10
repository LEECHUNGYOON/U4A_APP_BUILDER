(function(o){
    "use strict";

    o.onKeypad_Control = function(d){

        if(d.active == 'X'){
            Keyboard.show();
        }
        else {
            Keyboard.hide();
        }

    };

})(oAPP);