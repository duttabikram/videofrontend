import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://videobackend-llpa.onrender.com");

function App() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const chatEndRef = useRef(null);
  const isInitiatorRef = useRef(false);

  const roomId = "test-room";

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    init();

    socket.on("chat-message", (data) => {
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
      console.log("🎥 REMOTE STREAM RECEIVED");
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

    socket.on("user-joined", () => {
      console.log("🟢 I am initiator");
      isInitiatorRef.current = true;
    });

    socket.on("offer", async (offer) => {
      console.log("📥 Offer received");

      await peerRef.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);

      socket.emit("answer", { roomId, answer });
    });

    socket.on("answer", async (answer) => {
      console.log("📥 Answer received");

      await peerRef.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    });

    socket.on("ice-candidate", async (candidate) => {
      try {
        await peerRef.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (err) {
        console.error("ICE error", err);
      }
    });

    // ✅ Create offer ONLY if initiator
    setTimeout(async () => {
      if (isInitiatorRef.current) {
        console.log("📤 Creating offer");

        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);

        socket.emit("offer", { roomId, offer });
      }
    }, 1000);
  }

  function toggleMute() {
    const audioTrack = localVideoRef.current.srcObject.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  }

  function toggleCamera() {
    const videoTrack = localVideoRef.current.srcObject.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOff(!videoTrack.enabled);
  }

  function leaveCall() {
    localVideoRef.current?.srcObject
      ?.getTracks()
      .forEach((t) => t.stop());

    peerRef.current?.close();
    peerRef.current = null;

    localVideoRef.current.srcObject = null;
    remoteVideoRef.current.srcObject = null;

    socket.disconnect();
  }

  function sendMessage() {
    if (!message.trim()) return;

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
    <div style={{ display: "flex", height: "100vh", padding: "20px" }}>
      {/* LEFT */}
      <div style={{ flex: 2, textAlign: "center" }}>
        <h2>Google Meet Clone (1-to-1)</h2>

        <video ref={localVideoRef} autoPlay muted style={{ width: 300 }} />
        <video ref={remoteVideoRef} autoPlay style={{ width: 300 }} />

        <div style={{ marginTop: 10 }}>
          <button onClick={toggleCamera}>
            {isCameraOff ? "📷" : "📵"}
          </button>
          <button onClick={toggleMute} style={{ marginLeft: 8 }}>
            {isMuted ? "🔇" : "🔊"}
          </button>
          <button
            onClick={leaveCall}
            style={{ marginLeft: 8, background: "red", color: "white" }}
          >
            📞
          </button>
        </div>
      </div>

      {/* RIGHT CHAT */}
      <div
        style={{
          width: 450,
          height: 450,
          marginTop: 80,
          border: "1px solid #ccc",
          padding: 10,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h4>Chat</h4>

        <div style={{ flex: 1, overflowY: "auto", border: "1px solid #ddd" }}>
          {messages.map((m, i) => (
            <div key={i}>
              <strong>{m.sender === socket.id ? "Me" : "User"}:</strong>{" "}
              {m.message}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default App;
