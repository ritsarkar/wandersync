# Design System — WanderSync (Apple Find My Aesthetic)

## 1. Product Context
- **What this is:** WanderSync is a real-time convoy navigation and squad tracking platform designed for groups traveling together (cars, bikes, road trips, treks).
- **Who it's for:** Friends, road trippers, motorcycle clubs, and convoy leaders who need live situational awareness without clutter.
- **Space & Peers:** Apple Find My, Life360, Waze, Google Maps Squad Sharing.
- **Project Type:** Real-Time Squad Navigation Web App (Mobile-First responsive, PWA-ready).
- **Core Thesis:** *Glanceable simplicity at highway speed.* The map is the entire universe; the interface is a floating, frosted-glass lens that delivers instant clarity without obscuring the road.

---

## 2. Aesthetic Direction: Ultra-Minimal "Apple Find My"
- **Direction:** Clean, Ultra-Minimal iOS Find My HUD.
- **Decoration Level:** **Intentional**. Restrained translucent materials, frosted glass with specular top-edge lighting, soft drop shadows, and zero decorative visual slop (no unnecessary gradients, no random blobs, no 3D icons).
- **Mood:** Calm, effortless, precise, trustworthy. Like holding an iPhone natively running iOS 18 Find My.
- **Visual Thesis:**
  > "Full-bleed map canvas underneath floating, interruptible translucent glass modules that react with spring physics."

---

## 3. Typography System (San Francisco Discipline)

### Font Stack
- **Primary Interface & Headings:** `system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Plus Jakarta Sans", sans-serif`
  - *Rationale:* Native Apple look and feel across iOS Safari, macOS, and high-DPI Android displays. Ships built-in optical tracking and zero font-loading latency.
- **Telemetry, Speed & ETAs:** `"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`
  - *Rationale:* Strict `tabular-nums` alignment prevents numerical jitter when speed updates from 59 to 60 km/h or ETA counts down.
- **Fallbacks:** `system-ui`, `-apple-system`, `sans-serif`.

### Type Scale & Optical Tracking

| Level | Size | Weight | Line Height | Tracking | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Large Title** | 28px (1.75rem) | 700 Bold | 1.15 | `-0.025em` | Modal sheet titles, Destination name |
| **Title 2** | 20px (1.25rem) | 600 Semibold | 1.25 | `-0.015em` | Card headers, Squad section titles |
| **Headline** | 16px (1.0rem) | 600 Semibold | 1.35 | `-0.01em` | Member names, Route summary |
| **Body** | 14px (0.875rem) | 400 Regular | 1.45 | `0` | Subtitles, instructions, chat messages |
| **Subheadline** | 12px (0.75rem) | 500 Medium | 1.4 | `+0.01em` | Distance, timestamp, battery indicator |
| **Caption / Badge** | 10px (0.625rem) | 700 Bold | 1.2 | `+0.03em` | Status badges (LEADER, MOVING, SOS) |
| **Telemetry / Mono** | 14px (0.875rem) | 600 Semibold | 1.0 | `0` (tabular) | Speedometer (e.g. `68 km/h`), GPS accuracy |

---

## 4. Color Palette & Material Architecture

Apple Find My uses a neutral, translucent base where color is reserved **strictly for semantic meaning**.

### Canvas & Glass Surfaces
```css
/* Light Mode Materials */
--glass-bg-light: rgba(255, 255, 255, 0.82);
--glass-border-light: rgba(0, 0, 0, 0.08);
--glass-highlight-light: rgba(255, 255, 255, 0.6);
--glass-shadow-light: 0 12px 32px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.06);

/* Dark Mode Materials (Default) */
--glass-bg-dark: rgba(24, 24, 27, 0.84);
--glass-border-dark: rgba(255, 255, 255, 0.12);
--glass-highlight-dark: rgba(255, 255, 255, 0.18);
--glass-shadow-dark: 0 16px 40px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4);
```

### Apple System Semantic Accents
| Token | Hex | Role & Usage |
| :--- | :--- | :--- |
| **System Blue** | `#007AFF` | Primary Action, Your Route Polyline, Selected Traveler |
| **System Green** | `#34C759` | Moving Status (>5 km/h), Squad Online Radar, GPS Lock Active |
| **System Orange** | `#FF9500` | Meeting Spot (Rendezvous), Checkpoint Markers, Rest Stops |
| **System Red** | `#FF3B30` | Emergency SOS, Road Hazards, Severe Warning |
| **System Purple** | `#AF52DE` | Scenic Waypoint, Fuel / Petrol Station |
| **System Teal** | `#5AC8FA` | Alternative Travel Route 2 |

### Traveler Avatar Ring Palette
When multiple friends join, assign from Apple's calibrated squircle ring palette:
- Traveler 1 (You): `#007AFF` (Apple Blue)
- Traveler 2: `#34C759` (Apple Green)
- Traveler 3: `#AF52DE` (Apple Purple)
- Traveler 4: `#FF9500` (Apple Orange)
- Traveler 5: `#FF2D55` (Apple Pink)
- Traveler 6: `#5856D6` (Apple Indigo)

---

## 5. Micro-Layout & Touch Ergonomics

### 1-Handed Highway Ergonomics
- **Minimum Touch Target:** `48px × 48px` (expanded hit slop of 8px for vehicle vibrations).
- **The "Thumb Reach Zone":** All primary controls (Fit Squad, Recenter Me, Add Waypoint, Drawer Expand) are pinned in the bottom 40% of the screen.
- **Grab Handle Pill:** `36px × 5px` pill centered at the top of drawers (`border-radius: 9999px`, background `rgba(156, 163, 175, 0.4)`).
- **Continuous Squircles:**
  - Drawer Top Corners: `32px` (`rounded-t-[32px]`)
  - Floating Action Buttons: `9999px` (Pill / Circle)
  - Detail Cards: `20px` (`rounded-[20px]`)
  - Small Tags: `8px` (`rounded-lg`)

---

## 6. Motion & Spring Physics (WWDC Fluid Interfaces)

### Spring Configurations
- **Standard Sheet & Card Motion:**
  - Physics: Critically damped (`damping: 1.0`, `response: 0.35s`).
  - No cartoon bounce; clean, crisp settle.
- **Direct Touch Feedback:**
  ```css
  .apple-pressable {
    transition: transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1), opacity 120ms ease;
  }
  .apple-pressable:active {
    transform: scale(0.96);
    opacity: 0.88;
  }
  ```
- **Pulsing Radar Ring:**
  - Gentle 2.4s expansion with cubic bezier `cubic-bezier(0.25, 1, 0.5, 1)`, fading from 0.8 to 0 opacity.
- **Heading Cone Rotation:**
  - `transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)` to smoothly aim the vehicle heading without jumping.

---

## 7. Safe Choices vs. Deliberate Creative Risks

### Safe Choices (Category Baseline)
1. **Full-Bleed Map**: Standard Google Maps gesture interactions (pinch to zoom, two-finger rotate, pan).
2. **Bottom Sheet Pattern**: Users instantly recognize the Apple Maps / Find My expandable bottom drawer.
3. **Green / Amber / Red Semantics**: Universal roadside intuition (Green = moving, Amber = caution/rendezvous, Red = danger/SOS).

### Deliberate Creative Risks (Where WanderSync Gets Its Face)
1. **Live Rally Speedometer Pill**:
   - Rather than hiding speed in a sub-menu, display a floating, translucent telemetry pill showing real-time GPS speed, heading compass arrow, and satellite lock status.
2. **Squad Vector Roads**:
   - Polylines aren't just flat static ribbons; they have subtle directional pulse chevrons indicating the forward direction of traffic flow toward the rendezvous point.
3. **Haptic Roadside Checkpoints**:
   - Micro-vibration pulses (`navigator.vibrate([15, 30, 15])`) when crossing within 200m of a friend's reported road hazard or meeting spot.

---

## 8. Anti-Slop Discipline
- ❌ No generic purple-to-cyan SaaS gradients.
- ❌ No 3-column marketing feature cards inside the navigation app.
- ❌ No artificial parabolic "airplane fly" Bezier paths (always real Google Routes road geometries).
- ❌ No delayed transitions that lock user touch. Every drawer and card is draggable and interruptible.
