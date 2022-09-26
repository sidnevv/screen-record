import {useState, useEffect, useRef} from "react";
import {Puff, TailSpin} from 'react-loader-spinner'
import io from 'socket.io-client'
import './App.scss'

const SERVER_URI = 'http://localhost:4000'

let mediaRecorder = null
let dataChunks = []

const App = () => {
    const username = useRef(`User_${Date.now().toString().slice(-4)}`)
    const socketRef = useRef(io(SERVER_URI))
    const videoRef = useRef()
    const linkRef = useRef()

    const [screenStream, setScreenStream] = useState()
    const [voiceStream, setVoiceStream] = useState()
    const [recording, setRecording] = useState(false)
    const [loading, setLoading] = useState(true)
    const [record, setRecord] = useState(false)

    useEffect(() => {
        socketRef.current.emit('user:connected', username.current)
    }, [])

    useEffect(() => {
        ;(async () => {
            if (navigator.mediaDevices.getDisplayMedia) {
                try {
                    const _screenStream = await navigator.mediaDevices.getDisplayMedia({
                        video: true
                    })
                    setScreenStream(_screenStream)
                } catch (e) {
                    console.error('*** getDisplayMedia', e)
                    setLoading(false)
                }
            } else {
                console.warn('*** getDisplayMedia not supported')
                setLoading(false)
            }
        })()
    }, [])

    useEffect(() => {
        ;(async () => {
            if (navigator.mediaDevices.getUserMedia) {
                if (screenStream) {
                    try {
                        const _voiceStream = await navigator.mediaDevices.getUserMedia({
                            audio: true
                        })
                        setVoiceStream(_voiceStream)
                    } catch (e) {
                        console.error('*** getUserMedia', e)
                        setVoiceStream('unavailable')
                    } finally {
                        setLoading(false)
                    }
                }
            } else {
                console.warn('*** getUserMedia not supported')
            }
        })()
    }, [screenStream])

    const onClick = () => {
        if (!recording) {
            startRecording()
            setRecord(true)
        } else {
            if (mediaRecorder) {
                mediaRecorder.stop()
                setRecord(false)
            }
        }
    }

    const startRecording = () => {
        if (screenStream && voiceStream && !mediaRecorder) {
            setRecording(true)

            videoRef.current.removeAttribute('src')
            linkRef.current.removeAttribute('href')
            linkRef.current.removeAttribute('download')

            let mediaStream

            if (voiceStream === 'unavailable') {
                mediaStream = screenStream
            } else {
                mediaStream = new MediaStream([
                    ...screenStream.getVideoTracks(),
                    ...voiceStream.getAudioTracks()
                ])
            }

            mediaRecorder = new MediaRecorder(mediaStream)
            mediaRecorder.ondataavailable = ({data}) => {
                dataChunks.push(data)
                socketRef.current.emit('screenData:start', {
                    data,
                    username: username.current,
                })
            }
            mediaRecorder.onstop = stopRecording
            mediaRecorder.start(250)
        }
    }

    const stopRecording = () => {
      setRecording(false)

      socketRef.current.emit('screenData:end', username.current)

      const videoBlob = new Blob(dataChunks, {
        type: 'video/webm'
      })

      const videoSrc = URL.createObjectURL(videoBlob)

      videoRef.current.src = videoSrc
      linkRef.current.href = videoSrc
      linkRef.current.download = `${Date.now()}-${username.current}.webm`

      mediaRecorder = null
      dataChunks = []
    }

    if (loading) {
        return <TailSpin
            height="80"
            width="80"
            color="#0275d8"
            radius="1"
            visible={true}
        />
    }

    return (
        <>
            <h1>Screen Recording App</h1>
            {record ? (
                <Puff
                    height="80"
                    width="80"
                    radisu={1}
                    color="#d9534f"
                    ariaLabel="puff-loading"
                    wrapperStyle={{}}
                    wrapperClass=""
                    visible={true}
                />
            ) : null}
            <video controls ref={videoRef}></video>
            <a ref={linkRef}>Download</a>
            <button onClick={onClick} disabled={!voiceStream}>
                {!recording ? 'Start' : 'Stop'}
            </button>
        </>
    )
}

export default App