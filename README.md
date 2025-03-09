# Interdimensional cable : Synced TV YouTube Player

https://mrpyrotek.github.io/synced-interdimensional-cable/

This web-based app allows users to watch YouTube videos across multiple channels, all synced to a 10-minute block schedule. The app uses the YouTube IFrame API to load and control videos and generates a video sequence based on a "seed" derived from the current date and time.

The app offers two main views: a dynamic player view where videos play in sequence and a grid view where users can browse video thumbnails from multiple channels.

## Features

### 1. **Interdimensional Channel Sync**
   - The app generates a sequence of YouTube videos for each channel based on a unique "seed" that changes every 10-minute block, ensuring a synced and cohesive viewing experience.
   - The sequence of videos for each channel is updated periodically, keeping the experience fresh and aligned across all channels.

### 2. **YouTube IFrame API Integration**
   - YouTube videos are embedded using the IFrame API, allowing seamless playback and control within the app.
   - The player automatically starts muted and plays the next video in the sequence when the current video ends.

### 3. **Dynamic Video Sequence**
   - Videos are fetched from a JSON file (`list1.json`), where each entry contains the video ID, title, and duration.
   - Based on the current date, time, and the selected channel, the app generates a random sequence of videos for the next 10-minute block.
   - Cumulative time is calculated to determine when to switch to the next video in the sequence.

### 4. **Channel Management**
   - Users can change the channel either by selecting from a dropdown or by cycling through channels using the `changeChannelBy` function.
   - The selected channel is saved in the browser's `localStorage`, ensuring the channel preference is preserved across sessions.
   - The app can handle channels numbered 0-999, and users can even view a special "Mosaïque" channel (channel 0) which shows a grid of all active videos across multiple channels.

### 5. **Grid View**
   - A grid view displays video thumbnails from multiple channels.
   - Users can browse through the current video playing on each channel and click to switch to a new video.
   - The grid view is fully paginated, showing a maximum of 24 videos per page, and users can navigate between pages to discover more content.

### 6. **Video Notifications**
   - A notification overlay briefly shows the current channel and video title when the channel is changed, providing an easy way to stay informed on what’s playing.

### 7. **Responsive Design**
   - The app automatically adjusts the layout for different screen sizes, ensuring a smooth experience whether on desktop or mobile.

## Installation

1. Clone or download the repository.
2. Ensure you have a web server running, as this app requires HTTP(S) to fetch the `list1.json` file.
3. Add a `list1.json` file in the same directory, containing an array of YouTube video objects. Each object should contain:
   - `id`: The YouTube video ID.
   - `title`: The title of the video.
   - `duration`: The duration of the video in `MM:SS` or `SS` format.
4. Open `index.html` in a browser to start using the app.

## Example of `list1.json`

```json
[
  {
    "id": "dQw4w9WgXcQ",
    "title": "Never Gonna Give You Up",
    "duration": "3:33"
  },
  {
    "id": "wZZ7oK8wRLU",
    "title": "Another Video",
    "duration": "2:45"
  }
]
