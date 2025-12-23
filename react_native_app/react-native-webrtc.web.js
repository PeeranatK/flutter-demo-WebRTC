// Shim for react-native-webrtc on web
import React, { useEffect, useRef } from 'react';

export const RTCPeerConnection = window.RTCPeerConnection;
export const RTCIceCandidate = window.RTCIceCandidate;
export const RTCSessionDescription = window.RTCSessionDescription;


export const mediaDevices = navigator.mediaDevices;

export class RTCView extends React.Component {
    componentDidMount() {
        this.updateVideo();
    }

    componentDidUpdate() {
        this.updateVideo();
    }

    updateVideo() {
        const { streamURL, objectFit, mirror } = this.props;
        const videoElement = this.videoRef;
        if (videoElement && streamURL) {
            if (videoElement.srcObject !== streamURL) {
                videoElement.srcObject = streamURL;
            }
            // Note: streamURL in react-native-webrtc is a URL string or MediaStream. 
            // In our Signaling.js shim, we passed the stream object directly or wrapped it.
            // Let's verify how App.tsx uses it. App.tsx calls .toURL(). 
            // We might need to adjust App.tsx or this shim. 
            // Standard WebRTC: srcObject takes MediaStream. 
            // If .toURL() returns a string (Blob URL), src should be used.
        }
    }

    setRef = (e) => {
        this.videoRef = e;
    }

    render() {
        const { style, mirror, objectFit } = this.props;
        return (
            <video
                ref={this.setRef}
                autoPlay
                playsInline
                style={{
                    ...style,
                    transform: mirror ? 'scaleX(-1)' : undefined,
                    objectFit: objectFit === 'cover' ? 'cover' : 'contain',
                }}
            />
        );
    }
}

// polyfill toURL for web if it's missing on MediaStream
if (window.MediaStream && !window.MediaStream.prototype.toURL) {
    window.MediaStream.prototype.toURL = function () {
        return this; // Return self as object
    };
}
