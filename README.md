# Light card

A clean light entity card for Home Assistant. Shows a single light with a large bulb icon and brightness percentage, or a compact list view for multiple lights.

## Installation

### HACS (recommended)

1. In Home Assistant, go to **HACS → Frontend → ⋮ → Custom repositories**
2. Add this repository URL and set the category to **Lovelace**
3. Click **Download** on the light-card entry
4. Restart Home Assistant

### Manual

1. Copy `light-card.js` to your Home Assistant `config/www/` folder.
2. Add the resource in your Lovelace dashboard:
   - **Settings → Dashboards → Resources → Add Resource**
   - URL: `/local/light-card.js`
   - Type: `JavaScript module`

## Configuration

Either `entity` or `entities` is required.

| Option | Type | Default | Description |
|---|---|---|---|
| `entity` | string | — | A single light entity ID |
| `entities` | list | — | Multiple light entity IDs (see below) |
| `name` | string | entity name | Display name override (single entity only) |
| `title` | string | — | Card title (shown automatically for multiple entities) |
| `background` | string | `var(--card-background-color)` | Card background color |
| `interactions` | list | — | Tap/hold/double-tap actions (see below) |

### `entities` items

Each item in the `entities` list can be a plain entity ID string or an object:

```yaml
entities:
  - light.living_room                          # string shorthand
  - entity: light.office
    name: Office Lamp                          # name override
```

## Interactions

Attach actions to `tap`, `hold` (500 ms), or `double_tap` events by adding an `interactions` list.

```yaml
interactions:
  - trigger: tap        # tap | hold | double_tap  (default: tap)
    action: toggle      # see action reference below
```

| Action | Extra fields | Description |
|---|---|---|
| `more-info` | `entity` (optional) | Open the HA more-info dialog. Defaults to the first entity. |
| `toggle` | `entity` (optional) | Toggle the entity. Defaults to the first entity. |
| `call-service` | `service`, `service_data` | Call any HA service. `service` is `domain.service` format. |
| `navigate` | `path` | Navigate to a Lovelace path. |
| `url` | `url`, `target` | Open a URL. `target` defaults to `_blank`. |
| `none` | — | Explicit no-op. |

## Examples

**Single light:**
```yaml
type: custom:daires-hass-cards-light-card
entity: light.living_room
```

**Multiple lights:**
```yaml
type: custom:daires-hass-cards-light-card
title: Ground Floor
entities:
  - light.living_room
  - light.kitchen
  - light.hallway
```

**Tap to toggle, hold for more-info:**
```yaml
type: custom:daires-hass-cards-light-card
entity: light.living_room
interactions:
  - trigger: tap
    action: toggle
  - trigger: hold
    action: more-info
```

## Demo

Open `demo.html` in a browser to preview the card without Home Assistant.
