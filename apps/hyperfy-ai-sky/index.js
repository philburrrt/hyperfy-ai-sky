import React, { useEffect, useState, useRef } from 'react'
import { useWorld, useSyncState } from 'hyperfy'

// note: grid will be on the ground if app position is set to [0,0,0]

// get your API key from https://www.blockadelabs.com/
const KEY = 'YOUR_API_KEY'

export default function App() {
  // contains a variety of useful methods
  const world = useWorld()
  // will be continuously set to whatever exists in the input
  const [value, setValue] = useState(null)
  // handle grid visibility
  const [grid, setGrid] = useState(true)
  // read and write to multiplayer state
  const [s, dispatch] = useSyncState(s => s)
  const { skybox, status, submission, lastTime } = s
  const skyboxRef = useRef()

  // display 'skybox ready' for 5 seconds
  useEffect(() => {
    if (!world.isServer) return
    if (status === 'Skybox ready!') {
      setTimeout(() => {
        dispatch('setStatus', null)
      }, 5000)
    }
  }, [status])

  // get skybox upon submission
  useEffect(() => {
    if (!world.isServer) return
    if (!submission) return
    const load = async () => {
      // get a generator
      console.log('getting generator...')
      let generator
      try {
        dispatch('setStatus', 'Getting generator...')
        const generators = await world.http({
          method: 'GET',
          url: `https://backend.blockadelabs.com/api/v1/generators?api_key=${KEY}`,
        })
        console.log('generators', generators)
        generator = generators[0] // i guess we pick the first one?
        console.log('generator', generator)
      } catch (e) {
        console.log('error', e)
        dispatch('setStatus', 'Error getting generator')
        return
      }
      // start generating a skybox
      let result
      try {
        console.log('generating skybox...')
        dispatch('setStatus', 'Generating skybox...')
        const imagine = await world.http({
          method: 'POST',
          url: `https://backend.blockadelabs.com/api/v1/imagine/requests?api_key=${KEY}`,
          data: {
            generator: generator.generator,
            prompt: submission,
          },
        })
        result = imagine.request
        console.log('result', result)
      } catch (e) {
        console.log('error', e)
        dispatch('setStatus', 'Error generating skybox')
        return
      }
      // poll until file url is available
      try {
        console.log('waiting for skybox...')
        dispatch('setStatus', 'Waiting for skybox...')
        while (!result.file_url) {
          await sleep(5000)
          console.log('waiting for skybox...')
          const resp = await world.http({
            method: 'GET',
            url: `https://backend.blockadelabs.com/api/v1/imagine/requests/${result.id}?api_key=${KEY}`,
          })
          result = resp.request
          console.log('result', result)
        }
        // set skybox src
        console.log('SKYBOX READY', result.file_url)
        dispatch('setSkybox', result.file_url)
        dispatch('setStatus', 'Skybox ready!')
      } catch (e) {
        console.log('error', e)
        dispatch('setStatus', 'Error getting skybox')
        return
      }
    }
    load()
  }, [submission])

  // custom sleep solution. cannot use setInterval in SDK
  function sleep(ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms)
    })
  }

  return (
    <app>
      {/* optional tron grid */}
      {grid && <model src="grid.glb" />}
      {/* ui group */}
      <group position={[0, 1.5, -5]}>
        {/* grid button */}
        <text
          value="grid"
          onPointerDown={() => {
            setGrid(!grid)
          }}
          bgColor="black"
          color="white"
          scale={0.7}
          padding={0.1}
          bgRadius={0.1}
          position={[-1, 0.025, 0]}
        />
        {/* if there's a status message, display here */}
        {status && (
          <text
            value={status}
            bgColor="black"
            color="white"
            padding={0.075}
            bgRadius={0.075}
            position={[0, 0.4, 0]}
            maxWidth={1.5}
          />
        )}
        {/* display submission here while not null */}
        {submission && (
          <text
            value={`Prompt: ${submission}`}
            bgColor="black"
            color="white"
            padding={0.075}
            bgRadius={0.075}
            position={[-1.1, -0.25, 0]}
            maxWidth={1.5}
          />
        )}
        {/* textbox */}
        <input
          placeholder="Enter Prompt"
          bgColor="black"
          color="white"
          width={1.5}
          value={value}
          onChange={setValue}
        />
        {/* submit button */}
        <text
          value="Submit"
          onPointerDown={() => {
            const time = world.getTime()
            let remaining
            if (lastTime) {
              // 120 seocond timeout
              remaining = 120 - (time - lastTime)
            }
            if (remaining > 0) {
              remaining = Math.round(remaining * 100) / 100
              dispatch('setStatus', `Wait ${remaining} seconds`)
              return
            } else {
              dispatch('setSubmission', value, time)
            }
          }}
          bgColor="black"
          color="white"
          padding={0.1}
          bgRadius={0.1}
          position={[0, -0.25, 0]}
        />
        {/* if there's a skybox, download button appears */}
        {skybox && (
          <text
            value="Download"
            onPointerDown={() => {
              world.open(skybox, true)
            }}
            bgColor="black"
            color="white"
            scale={0.7}
            padding={0.1}
            bgRadius={0.1}
            position={[0.525, -0.25, 0]}
          />
        )}
      </group>
      {/* if there's a skybox, display it */}
      {skybox && <skysphere ref={skyboxRef} src={skybox} encoding="srgb" />}
    </app>
  )
}

const initialState = {
  skybox: null,
  status: null,
  submission: null,
  lastTime: null,
}

export function getStore(state = initialState) {
  return {
    state,
    actions: {
      setStatus(state, status) {
        state.status = status
      },
      setSkybox(state, skybox) {
        state.skybox = skybox
      },
      setSubmission(state, submission, lastTime) {
        state.submission = submission
        state.lastTime = lastTime
      },
    },
  }
}
