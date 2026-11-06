# KIPP glass visual update

Source visual truth: user-attached three-phone teal ChatAI reference in this conversation (2048 × 1536). No original standalone orb or font specification supplied.
Implementation: http://localhost:8081, Expo SDK 58.
Evidence: qa/voice-glass.png and qa/home-glass.png.
Viewport: 393 × 852 CSS pixels, mobile browser; screenshots 393 × 852. Reference contains device frames at different scales, so pixel-perfect density normalization has not been completed.
State: dark theme, empty local account, home and idle voice mode; Memory prompt filter selected in home evidence.

## Findings and changes
- Replaced blurred gradient sphere with transparent generated glass artwork, preserving crisp liquid folds, cyan rim, deep petrol reflections and highlights.
- Changed dark surfaces to navy/charcoal and brighter teal hero; adjusted cropped home orb scale.
- Reduced title/section type weight to regular. Inter remains the existing app font; reference font identity is unknown.
- Preserved KIPP content, real features and approval behavior. Reference sample chat/reminder content was not injected into user data.
- Subtle transform animation respects reduced motion and stops when the route loses focus.

## Comparison history
1. Initial browser run exposed a navigation-context error from external React Navigation useIsFocused. Replaced with Expo Router's SDK 58 export and reloaded.
2. Captured home and voice successfully after the fix. Fine glass reflections are visible at both sizes. Adjusted heading weights and captured again.

## Required fidelity surfaces
- Fonts: Inter regular/medium; visual reference appears more geometric. Exact font matching remains unverified.
- Spacing: mobile hero, two feature cards, prompt chips and floating navigation preserved. Voice sphere is 260 CSS px including transparent padding.
- Colors: navy background, charcoal cards, teal light and cyan orb now follow reference direction; inferred colors, not sampled originals.
- Image: generated RGBA asset, 1254 × 1254, bundled locally. Recreates art direction but is not the original reference asset. Motion animates artwork rather than simulating fluid geometry.
- Copy: KIPP copy and working task/reminder features intentionally retained.

## Validation
- Home to chat, chat to voice, back to chat/home, and Memory filter tested in browser.
- Console checked: earlier navigation error retained in logs; no later error observed after correction.
- Expo lint passed. TypeScript noEmit passed.
- iOS/Android device rendering and microphone/API behavior not tested in this visual-only pass.

## Remaining verification
A normalized combined source/implementation comparison and native-device capture are still needed before claiming an exact match. Current screenshots establish the visual implementation, not pixel-perfect parity.

final result: blocked

## Fluid animation follow-up
User requested genuine surface flow instead of image transforms.
- Replaced whole-image transform animation with a WebGL fragment shader inside Expo's supported DOM component boundary.
- The bundled glass texture is advected through a time-varying interior flow field. Rim stays fixed; sheen and internal folds change continuously. Active voice phases increase flow energy smoothly.
- Mipmapped 1024px GPU texture removes highlight aliasing. Display resolution capped at 2x.
- Frame loop pauses when unfocused, backgrounded, document hidden or reduced motion enabled. GPU resources and event listeners are cleaned up; context loss uses the image fallback and restores the renderer.
- Browser evidence: qa/fluid-frame-a.png, qa/fluid-frame-b.png show distinct internal shapes at the same fixed position. qa/fluid-final.png shows the smoothed final rendering. Browser console has no new shader errors.
- Expo lint and TypeScript noEmit passed. Android production export including the DOM bundle passed.
- Added @expo/metro-runtime 58.0.15 directly (already present transitively); native DOM bundling requires it at project root. Lockfile uses the official registry URL and integrity.
- Native device performance and exact reference parity remain unverified; earlier overall visual QA blocked status is retained. Fluid animation itself was observed in the browser.
