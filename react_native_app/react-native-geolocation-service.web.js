export default {
    getCurrentPosition: (success, error, options) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(success, error, options);
        } else {
            error({ code: 0, message: 'Geolocation not supported' });
        }
    },
    watchPosition: (success, error, options) => {
        if (navigator.geolocation) {
            return navigator.geolocation.watchPosition(success, error, options);
        }
        error({ code: 0, message: 'Geolocation not supported' });
        return -1;
    },
    clearWatch: (watchID) => {
        if (navigator.geolocation) {
            navigator.geolocation.clearWatch(watchID);
        }
    },
    stopObserving: () => { },
};
