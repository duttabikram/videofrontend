import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./Meet.css";

const socket = io("https://videobackend-llpa.onrender.com");

function App() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const chatEndRef = useRef(null);

  const roomId = "test-room";

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    init();

    socket.on("chat-message", (data) => {
      console.log("📩 Chat received:", data);
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off("chat-message");
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function init() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localVideoRef.current.srcObject = stream;

    peerRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    stream.getTracks().forEach((track) =>
      peerRef.current.addTrack(track, stream)
    );

    peerRef.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    socket.emit("join-room", roomId);

    socket.on("user-joined", async () => {
      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer });
    });

    socket.on("offer", async (offer) => {
      await peerRef.current.setRemoteDescription(offer);
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      socket.emit("answer", { roomId, answer });
    });

    socket.on("answer", async (answer) => {
      await peerRef.current.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", async (candidate) => {
      try {
        await peerRef.current.addIceCandidate(candidate);
      } catch (err) {
        console.error(err);
      }
    });
  }

  function toggleMute() {
    const audioTrack =
      localVideoRef.current.srcObject.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  }

  function toggleCamera() {
    const videoTrack =
      localVideoRef.current.srcObject.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOff(!videoTrack.enabled);
  }

function leaveCall() {
  // Stop local media
  if (localVideoRef.current?.srcObject) {
    localVideoRef.current.srcObject
      .getTracks()
      .forEach(track => track.stop());
  }

  // Close peer connection
  if (peerRef.current) {
    peerRef.current.close();
    peerRef.current = null;
  }

  // Clear video elements
  if (localVideoRef.current) {
    localVideoRef.current.srcObject = null;
  }

  if (remoteVideoRef.current) {
    remoteVideoRef.current.srcObject = null;
  }

  // Disconnect socket
  if (socket.connected) {
    socket.disconnect();
  }
}


  function sendMessage() {
    if (!message.trim()) return;

    console.log("📤 Sending chat:", message);

    socket.emit("chat-message", {
      roomId,
      message,
      sender: socket.id,
    });

    setMessages((prev) => [
      ...prev,
      { sender: socket.id, message },
    ]);

    setMessage("");
  }


  return (
<div className="meet-container">
  {/* LEFT SIDE */}
  <div className="video-section">
    <h2>Google Meet Clone</h2>

    <div className="video-wrapper">
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        className="video-box"
      />
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="video-box"
      />
    </div>

    <div className="controls">
      <button className="control-btn" onClick={toggleCamera}>
        {isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
      </button>

      <button className="control-btn" onClick={toggleMute}>
        {isMuted ? "Unmute" : "Mute"}
      </button>

      <button
        className="control-btn leave-btn"
        onClick={leaveCall}
      >
        Leave Call
      </button>
    </div>
  </div>

  {/* RIGHT SIDE CHAT */}
  <div className="chat-section">
    <h4>Chat</h4>

    <div className="chat-box">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`message ${
            msg.sender === socket.id ? "me" : "other"
          }`}
        >
          <span>{msg.message}</span>
        </div>
      ))}
      <div ref={chatEndRef} />
    </div>

    <div className="chat-input">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        placeholder="Type a message..."
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  </div>
</div>
  );
}

export default App;
