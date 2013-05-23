const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

var CryptoJSWrapper = {};

var lockBtn = null;
var mWindow = null;
let gAddonData = null;
const OBS = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefService).getBranch("extensions.fennec-lock."); 
var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                     .getService(Components.interfaces.nsIPromptService);

function isNativeUI() {
  let appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
  return (appInfo.ID == "{aa3c5121-dab2-40e2-81ca-7ea25febc110}");
}

function lock(window) {
  var salt = prefs.getCharPref("salt");
  var passphrase = prefs.getCharPref("passphrase");
  
  window.BrowserApp.addTab("about:blank"); 
  var password = {value: ""};
  var check = {value: true};
  var result;
  
  do {
    password = {value: ""};
    result = prompts.promptPassword(null, "Firefox is locked!", "Enter passphrase...", password, null, check);
  } while( CryptoJSWrapper.CryptoJS.SHA3(password.value+salt) != passphrase || result==false );
  
  window.BrowserApp.closeTab(window.BrowserApp.selectedTab);
  window.NativeWindow.toast.show("Firefox Unlocked!", "short"); 
}

function loadIntoWindow(window) {
  if (!window)
    return;

  if (isNativeUI()) {
    mWindow = window;
    let iconUrl = gAddonData.resourceURI.spec + "icon.png";
    lockBtn = window.NativeWindow.menu.add("Lock", iconUrl, function() { lock(window); });
  }
}

function unloadFromWindow(window) {
  if (!window)
    return;

  if (isNativeUI()) {
    window.NativeWindow.menu.remove(lockBtn);
  }
}

let optionObserver = {
    observe: function(subject, topic, data) {
        if (topic !== 'addon-options-displayed' || data !== 'lock@geopiskas.com') {
            return;
        }
        let document = subject.QueryInterface(Ci.nsIDOMDocument);
        let button = document.getElementById('change-password');
        button.addEventListener('command', this.changePassword);
    },
    changePassword: function(event) {

      
	var salt = prefs.getCharPref("salt");
        var passphrase = prefs.getCharPref("passphrase");
        
        var password0 = {value: ""};
        var check = {value: true};
        var result;

        result = prompts.promptPassword(null, "Firefox is locked!", "Enter passphrase...", password0, null, check);
        if(result==true && CryptoJSWrapper.CryptoJS.SHA3(password0.value+salt) == passphrase){ 

            var password1 = {value: ""};
            var password2 = {value: ""};


            result = prompts.promptPassword(null, "Change Password", "Enter a new passphrase...", password1, null, check);
            if(result==true){ 
                result = prompts.promptPassword(null, "Change Password", "Re-enter passphrase...", password2, null, check); 
                if(result==true && password1.value==password2.value){
                    prefs.setCharPref("passphrase",CryptoJSWrapper.CryptoJS.SHA3(password2.value + salt) );
                    mWindow.NativeWindow.toast.show("Passphrase changed!", "short");
                } else { 
                    mWindow.NativeWindow.toast.show("Passphrase unchanged!", "short");
                }
            } else { 
                mWindow.NativeWindow.toast.show("Passphrase unchanged!", "short");
            } 
        } else { 
            mWindow.NativeWindow.toast.show("Passphrase unchanged!", "short");
        } 
    }
}

var windowListener = {
  onOpenWindow: function(aWindow) {
    // Wait for the window to finish loading
    let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    domWindow.addEventListener("load", function() {
      domWindow.removeEventListener("load", arguments.callee, false);
      loadIntoWindow(domWindow);
    }, false);
  },
  
  onCloseWindow: function(aWindow) {},
  onWindowTitleChange: function(aWindow, aTitle) {}
};

function startup(aData, aReason) {
  gAddonData = aData;
  
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);

  // Load into any existing windows
  let windows = wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    loadIntoWindow(domWindow);
  }
  
  Services.scriptloader.loadSubScript(aData.resourceURI.spec + "crypto/sha3.js", CryptoJSWrapper);
  
  // Load into any new windows
  wm.addListener(windowListener);
  OBS.addObserver(optionObserver, 'addon-options-displayed', false);
}

function shutdown(aData, aReason) {
  // When the application is shutting down we normally don't have to clean
  // up any UI changes made
  if (aReason == APP_SHUTDOWN)
    return;

  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);

  // Stop listening for new windows
  wm.removeListener(windowListener);

  // Unload from any existing windows
  let windows = wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    unloadFromWindow(domWindow);
  }
  OBS.removeObserver(optionObserver, 'addon-options-displayed', false);
}

function install(aData, aReason) {
    Services.scriptloader.loadSubScript(aData.resourceURI.spec + "crypto/sha3.js", CryptoJSWrapper);
    var salt = CryptoJSWrapper.CryptoJS.lib.WordArray.random(32);
    prefs.setCharPref("salt",salt);
    
    var password = {value: ""};
    var password1 = {value: ""};
    var check = {value: true};
    var result;

    var ok = false;
    do {
        password = {value: ""};
        password1 = {value: ""};
        result = prompts.promptPassword(null, "Lock set-up.", "Enter a new passphrase...", password, null, check);
        if(result==true){
            result = prompts.promptPassword(null, "Thanks for using Lock!", "Re-enter passphrase...", password1, null, check);
            if(result==true && password.value==password1.value){
                prefs.setCharPref("passphrase",CryptoJSWrapper.CryptoJS.SHA3(password.value + salt) );
                ok=true;
            }
        }
    }while(ok==false);
}

function uninstall(aData, aReason) {}
