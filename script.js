const JSON_FILE_PATH = 'list1.json';  // Path to your JSON file
let player;
let videoList = [];
let videoSequence = [];
let cumulativeTime = []; // To keep track of the cumulative time for each video
let currentIndex = 0;
let isChangingVideo = false;
let currentChannel = 1; // Default channel
let lastGeneratedSeed = '';
let currentPage = 1;
let itemsPerPage = 24;
let gridVideos = [];
let notificationTimeout;
let mosaicRefreshInterval;
let autoHideTimeout;
let isAutoHideEnabled = false;
let iconAutoHideTimeout;
let isIconAutoHideEnabled = false;

// Load YouTube IFrame API
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tag);

// Convert video duration (e.g., "0:46") into seconds
function parseDuration(duration) {
    const parts = duration.split(':');
    let seconds = 0;
    if (parts.length === 2) {
        seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else {
        seconds = parseInt(parts[0]);
    }
    return seconds;
}

// Hash function to convert a string to a number
function stringToHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

// Seeded PRNG based on the hashed seed value
function seededRandom(seed) {
    const hash = stringToHash(seed); // Convert seed to a number
    const x = Math.sin(hash) * 10000;
    return x - Math.floor(x); // Ensure a value between 0 and 1
}

// Fetch the JSON list from file
async function fetchVideoList() {
    try {
        const response = await fetch(JSON_FILE_PATH);
        const data = await response.json();
        videoList = data;
        console.log(`Total videos fetched: ${videoList.length}`);

        // Generate seed based on current date and 120-minute block
        const seed = generateSeed();
        videoSequence = generateVideoSequence(seed); // Generate the sequence for the 120-minute block
        calculateCumulativeTime(); // Calculate the cumulative time for each video
        updateCurrentInfo();

        console.log("Video Sequence for the 120-Minute Block:", videoSequence);
    } catch (error) {
        console.error('Error fetching video list:', error);
    }
}

// Generate the video sequence for the 120-minute block
function generateVideoSequence(seed) {
    const sequence = [];
    let totalDuration = 0;
    const targetDuration = 120 * 60; // 120 minutes in seconds
    
    // Keep adding videos until we exceed the target duration
    while (totalDuration < targetDuration) {
        const blockSeed = seed + '-' + sequence.length;
        const randomIndex = Math.floor(seededRandom(blockSeed) * videoList.length);
        const video = videoList[randomIndex];
        const duration = parseDuration(video.duration);
        
        sequence.push(video);
        totalDuration += duration;
    }
    
    return sequence;
}

// Generate a seed based on the current date and 120-minute block
function generateSeed() {
    const now = new Date();
    const franceTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
    const minutes = franceTime.getMinutes();
    const hours = franceTime.getHours();
    const totalMinutes = hours * 60 + minutes;
    const blockStart = Math.floor(totalMinutes / 120) * 120; // Round down to nearest 120 minutes
    const seed = `${franceTime.getFullYear()}-${franceTime.getMonth() + 1}-${franceTime.getDate()}-${blockStart}-ch${currentChannel}`;
    return seed;
}

// Calculate cumulative time for each video
function calculateCumulativeTime() {
    cumulativeTime = [];
    let totalTime = 0;
    for (let i = 0; i < videoSequence.length; i++) {
        const duration = parseDuration(videoSequence[i].duration);
        totalTime += duration;
        cumulativeTime.push(totalTime); // Store cumulative time for each video
    }
}

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        playerVars: {
            'autoplay': 1,
            'controls': 1,
            'rel': 0,
            'showinfo': 1,
            'modestbranding': 1,
            'fs': 1,
            'enablejsapi': 1,
            'mute': 1,  // Start muted
            'playsinline': 1  // Better mobile support
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

async function onPlayerReady(event) {
    console.log('Player ready');
    document.getElementById('loadingOverlay').style.display = 'none';
    
    // Load saved channel or default to 1
    const savedChannel = localStorage.getItem('selectedChannel');
    if (savedChannel) {
        currentChannel = parseInt(savedChannel);
    }
    
    // Update the channel number in the icon
    const channelNumberElement = document.querySelector('.channel-number');
    channelNumberElement.textContent = currentChannel;
    
    await fetchVideoList();
    playVideoForCurrentBlock();
    showUnmutePrompt();
    updateChannelIcon(currentChannel);
}

function onPlayerStateChange(event) {
    if (isChangingVideo) return;

    if (event.data === YT.PlayerState.ENDED) {
        currentIndex++;
        if (currentIndex >= videoSequence.length) {
            window.location.reload();
        } else {
            const nextVideo = videoSequence[currentIndex];
            playVideoById(nextVideo.id, 0);
        }
    }
}

function playVideoById(videoId, startTime) {
    isChangingVideo = true;
    const wasMuted = player.isMuted();  // Check if player was muted
    player.loadVideoById({
        videoId: videoId,
        startSeconds: startTime,
        suggestedQuality: 'hd720'
    });
    updateCurrentInfo();
    if (wasMuted) {
        player.mute();  // Maintain mute state if it was muted
    }
    player.playVideo();
    setTimeout(() => { isChangingVideo = false; }, 1000);
}

// Play the video corresponding to the current 120-minute block
function playVideoForCurrentBlock() {
    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();
    const totalMinutes = currentHour * 60 + currentMinute;
    const minutesIntoBlock = totalMinutes % 120; // Get minutes into current 120-minute block
    const totalSeconds = minutesIntoBlock * 60 + now.getSeconds();

    console.log('Minutes into block:', minutesIntoBlock);
    console.log('Seconds into block:', totalSeconds);
    console.log('Current channel:', currentChannel);

    // Use the existing videoSequence if it exists and matches current block
    // otherwise generate new sequence
    const currentSeed = generateSeed();
    if (!videoSequence.length || currentSeed !== lastGeneratedSeed) {
        videoSequence = generateVideoSequence(currentSeed);
        lastGeneratedSeed = currentSeed;
        calculateCumulativeTime();
    }

    // Find the current video and start time
    let currentVideoIndex = 0;
    let previousCumulativeTime = 0;
    
    for (let i = 0; i < cumulativeTime.length; i++) {
        if (totalSeconds < cumulativeTime[i]) {
            currentVideoIndex = i;
            previousCumulativeTime = i > 0 ? cumulativeTime[i - 1] : 0;
            break;
        }
    }

    const startTime = totalSeconds - previousCumulativeTime;
    const currentVideo = videoSequence[currentVideoIndex];

    if (currentVideo) {
        console.log(`Playing video ${currentVideoIndex + 1} at ${startTime} seconds`);
        playVideoById(currentVideo.id, startTime);
        currentIndex = currentVideoIndex; // Update the current index for the info panel
    } else {
        console.error('No video found for current time');
    }
}

// Helper to update current video info
function updateCurrentInfo() {
    const currentVideo = videoSequence[currentIndex];
    document.getElementById('currentInfo').innerText = 
        `Channel ${currentChannel} - Current Video: ${currentVideo ? currentVideo.title : 'Loading...'}`;
}

function showUnmutePrompt() {
    const overlay = document.getElementById('unmuteOverlay');
    overlay.style.display = 'block';
    
    const handleUnmute = () => {
        player.unMute();
        player.playVideo();
        overlay.style.display = 'none';
        overlay.removeEventListener('click', handleUnmute);
    };
    
    overlay.addEventListener('click', handleUnmute);
}

// Modify the changeChannel function
function changeChannel() {
    const select = document.getElementById('channelSelect');
    currentChannel = parseInt(select.value);
    
    localStorage.setItem('selectedChannel', currentChannel);
    
    lastGeneratedSeed = '';
    playVideoForCurrentBlock();
    updateCurrentInfo();
    
    // Show notification with current video title
    const currentVideo = videoSequence[currentIndex];
    showChannelNotification(currentChannel, currentVideo.title);
}

// Update the togglePanel function
function togglePanel() {
    const panel = document.getElementById('optionsPanel');
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
    } else {
        panel.style.display = 'block';
    }
}

// Add shared function for synchronized appearance
function showChannelElements(channelNumber, videoTitle) {
    const channelIcon = document.getElementById('channelIcon');
    const notification = document.getElementById('channelNotification');
    const titleElement = document.getElementById('channelTitle');
    const videoTitleElement = document.getElementById('channelVideoTitle');
    const channelNumberElement = channelIcon.querySelector('.channel-number');
    
    // Hide both elements immediately
    channelIcon.style.opacity = '0';
    notification.style.opacity = '0';
    notification.style.display = 'block';
    
    // Update content
    titleElement.textContent = `Channel ${channelNumber}`;
    videoTitleElement.textContent = videoTitle;
    channelNumberElement.textContent = channelNumber;
    
    // Show both elements after 200ms
    setTimeout(() => {
        channelIcon.style.transition = 'opacity 0.15s ease-in-out';
        notification.style.transition = 'opacity 0.15s ease-in-out';
        channelIcon.style.opacity = '1';
        notification.style.opacity = '1';
        
        // Handle notification fade out after 2 seconds
        notificationTimeout = setTimeout(() => {
            notification.style.transition = 'opacity 0.3s ease-in-out';
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 300);
        }, 2000);
    }, 200);
}

// Modify changeChannelBy to use the shared function
function changeChannelBy(delta) {
    // Check if we're in mosaic mode
    if (document.getElementById('gridView').style.display === 'block') {
        // In mosaic mode, change pages instead of channels
        changePage(delta);
        return;
    }

    // Channel changing logic
    let newValue;
    if (delta > 0) {
        newValue = currentChannel + 1;
        if (newValue > 999) newValue = 0;
    } else {
        newValue = currentChannel - 1;
        if (newValue < 0) newValue = 999;
    }
    
    currentChannel = newValue;
    localStorage.setItem('selectedChannel', newValue);
    
    // Update channel and show elements
    lastGeneratedSeed = '';
    playVideoForCurrentBlock();
    updateCurrentInfo();
    
    // Show both elements with synchronized timing
    const currentVideo = videoSequence[currentIndex];
    showChannelElements(newValue, currentVideo.title);
    
    // Update the channel icon with new shape and texture
    updateChannelIcon(newValue);
}

function showChannelNotification(channelNumber, videoTitle) {
    const channelNotification = document.getElementById('channelNotification');
    const channelTitle = document.getElementById('channelTitle');
    const channelVideoTitle = document.getElementById('channelVideoTitle');
    
    // Clear any existing timeouts
    if (channelNotification.fadeTimeout) {
        clearTimeout(channelNotification.fadeTimeout);
    }
    if (channelNotification.hideTimeout) {
        clearTimeout(channelNotification.hideTimeout);
    }
    
    // Reset opacity and display
    channelNotification.style.opacity = '1';
    channelNotification.style.display = 'block';
    
    // Update the content
    channelTitle.textContent = `Channel ${channelNumber}`;
    channelVideoTitle.textContent = videoTitle;
    
    // Set a new timeout for hiding
    channelNotification.fadeTimeout = setTimeout(() => {
        channelNotification.style.opacity = '0';
        channelNotification.hideTimeout = setTimeout(() => {
            channelNotification.style.display = 'none';
        }, 300);
    }, 5000);
}

function closeMosaic() {
    const playerView = document.getElementById('player');
    const gridView = document.getElementById('gridView');
    playerView.style.display = 'block';
    gridView.style.display = 'none';
    
    // Resume playing the current channel
    playVideoForCurrentBlock();
}

// Modify goToChannel0 to toggle the mosaic view
function goToChannel0() {
    const gridView = document.getElementById('gridView');
    
    // If mosaic is already visible, close it
    if (gridView.style.display === 'block') {
        closeMosaic();
        document.getElementById('channelIcon').style.display = 'none';
        return;
    }
    
    // Open mosaic without changing channel
    loadGridView();
}

// Modify startMosaicRefresh function
function startMosaicRefresh() {
    // Clear any existing interval
    if (mosaicRefreshInterval) {
        clearInterval(mosaicRefreshInterval);
    }
    
    // Set new interval to update every 2 seconds
    mosaicRefreshInterval = setInterval(() => {
        if (document.getElementById('gridView').style.display === 'block') {  // Only refresh if mosaic is visible
            updateMosaicContent();
        }
    }, 2000); // 2 seconds
}

// Add a helper function to calculate current time in block
function getCurrentTimeInBlock() {
    const now = new Date();
    const franceTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
    const minutes = franceTime.getMinutes();
    const hours = franceTime.getHours();
    const totalMinutes = hours * 60 + minutes;
    const minutesIntoBlock = totalMinutes % 120;
    const totalSeconds = minutesIntoBlock * 60 + franceTime.getSeconds();
    return totalSeconds;
}

// Modify loadGridView to use the new time calculation
async function loadGridView() {
    const playerView = document.getElementById('player');
    const gridView = document.getElementById('gridView');
    playerView.style.display = 'none';
    gridView.style.display = 'block';
    
    // Update itemsPerPage based on screen size
    itemsPerPage = calculateItemsPerPage();
    
    // Initialize gridVideos array
    gridVideos = [];
    const totalSeconds = getCurrentTimeInBlock();

    // Generate sequences for channels 1-999
    for (let channel = 1; channel <= 999; channel++) {
        const channelSeed = generateSeed().replace(`ch${currentChannel}`, `ch${channel}`);
        const sequence = generateVideoSequence(channelSeed);
        
        // Calculate which video should be playing now
        let currentVideoIndex = 0;
        let cumulativeSeconds = 0;
        
        for (let i = 0; i < sequence.length; i++) {
            cumulativeSeconds += parseDuration(sequence[i].duration);
            if (totalSeconds < cumulativeSeconds) {
                currentVideoIndex = i;
                break;
            }
        }

        // Add only the current video from this channel
        gridVideos.push({
            ...sequence[currentVideoIndex],
            channel: channel
        });
    }
    
    // Calculate which page contains the current channel
    const channelIndex = currentChannel - 1;
    currentPage = Math.floor(channelIndex / itemsPerPage) + 1;
    
    displayCurrentPage();
    
    // Start the refresh interval
    startMosaicRefresh();
}

function displayCurrentPage() {
    const grid = document.getElementById('thumbnailGrid');
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageVideos = gridVideos.slice(start, end);
    
    // Create or update grid items
    const existingItems = grid.children;
    const newItems = pageVideos.map(video => `
        <div class="thumbnail-item" onclick="playFromGrid('${video.id}', ${video.channel})">
            <img src="https://img.youtube.com/vi/${video.id}/mqdefault.jpg" alt="${video.title}">
            <div class="thumbnail-info">
                <div style="font-size: 1.2em; margin-bottom: 4px;">Channel ${video.channel}</div>
                <div style="font-size: 0.9em; opacity: 0.8;">${video.title}</div>
            </div>
        </div>
    `).join('');
    
    // Only update if the content has changed
    if (grid.innerHTML !== newItems) {
        grid.innerHTML = newItems;
    }
    
    updatePagination();
}

function updatePagination() {
    const pagination = document.getElementById('gridPagination');
    const totalPages = Math.ceil(gridVideos.length / itemsPerPage);
    const maxVisiblePages = Math.min(
        Math.floor(window.innerWidth / 100), // Approximate width needed for each button
        7 // Maximum number of visible page buttons
    );
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust startPage if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    let paginationHTML = `
        <button onclick="changePage(-1)" ${currentPage === 1 ? 'disabled' : ''}>◀</button>
    `;
    
    if (startPage > 1) {
        paginationHTML += `
            <button onclick="goToPage(1)">1</button>
            ${startPage > 2 ? '<span>...</span>' : ''}
        `;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button onclick="goToPage(${i})" 
                    ${i === currentPage ? 'style="background: rgba(255, 255, 255, 0.4);"' : ''}>
                ${i}
            </button>
        `;
    }
    
    if (endPage < totalPages) {
        paginationHTML += `
            ${endPage < totalPages - 1 ? '<span>...</span>' : ''}
            <button onclick="goToPage(${totalPages})">${totalPages}</button>
        `;
    }
    
    paginationHTML += `
        <button onclick="changePage(1)" ${currentPage === totalPages ? 'disabled' : ''}>▶</button>
    `;
    
    pagination.innerHTML = paginationHTML;
}

function goToPage(page) {
    currentPage = page;
    displayCurrentPage();
}

// Modify playFromGrid to remove channel select related code
function playFromGrid(videoId, channel) {
    // Stop the refresh interval
    if (mosaicRefreshInterval) {
        clearInterval(mosaicRefreshInterval);
    }
    
    // Update channel
    currentChannel = channel;
    localStorage.setItem('selectedChannel', channel);
    
    // Switch back to player view
    const playerView = document.getElementById('player');
    const gridView = document.getElementById('gridView');
    playerView.style.display = 'block';
    gridView.style.display = 'none';
    
    // Show the channel icon and update channel number
    const channelIcon = document.getElementById('channelIcon');
    const channelNumberElement = channelIcon.querySelector('.channel-number');
    channelIcon.style.display = 'flex';
    channelNumberElement.textContent = channel;
    
    // Generate sequence with the same seed as the mosaic view
    videoSequence = generateVideoSequence(generateSeed());
    calculateCumulativeTime();
    
    // Calculate which video should be playing now
    const totalSeconds = getCurrentTimeInBlock();
    let currentVideoIndex = 0;
    let cumulativeSeconds = 0;
    
    for (let i = 0; i < videoSequence.length; i++) {
        cumulativeSeconds += parseDuration(videoSequence[i].duration);
        if (totalSeconds < cumulativeSeconds) {
            currentVideoIndex = i;
            break;
        }
    }
    
    // Update current index to match the calculated video
    currentIndex = currentVideoIndex;
    
    // Play the current video for this channel
    playVideoForCurrentBlock();
    
    // Update the channel icon with new shape and texture
    updateChannelIcon(channel);
    
    // Show notification
    const currentVideo = videoSequence[currentIndex];
    if (currentVideo) {
        showChannelNotification(channel, currentVideo.title);
    }
}

// Update the itemsPerPage calculation based on screen size
function calculateItemsPerPage() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight - 100; // Account for pagination and margins
    
    // Calculate approximate number of columns and rows that can fit
    const thumbnailWidth = viewportWidth >= 1920 ? 400 : 
                          viewportWidth >= 1280 ? 300 : 
                          viewportWidth >= 768 ? 250 : 200;
    
    const thumbnailHeight = thumbnailWidth * (9/16); // maintain 16:9 aspect ratio
    const gap = viewportWidth >= 1920 ? 25 : 
                viewportWidth >= 1280 ? 20 : 
                viewportWidth >= 768 ? 15 : 10;
    
    const columns = Math.floor((viewportWidth - 40) / (thumbnailWidth + gap)); // Account for padding
    const rows = Math.floor((viewportHeight - 40) / (thumbnailHeight + gap)); // Account for padding
    
    return columns * rows;
}

// Add window resize handler
window.addEventListener('resize', () => {
    if (document.getElementById('gridView').style.display === 'block') { // Only recalculate if in grid view
        itemsPerPage = calculateItemsPerPage();
        displayCurrentPage();
    }
});

// Add this function before updatePagination
function changePage(delta) {
    const totalPages = Math.ceil(gridVideos.length / itemsPerPage);
    const newPage = Math.max(1, Math.min(currentPage + delta, totalPages));
    if (newPage !== currentPage) {
        currentPage = newPage;
        displayCurrentPage();
    }
}

// Add cleanup when leaving the page
window.addEventListener('beforeunload', () => {
    if (mosaicRefreshInterval) {
        clearInterval(mosaicRefreshInterval);
    }
    if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
    }
    if (iconAutoHideTimeout) {
        clearTimeout(iconAutoHideTimeout);
    }
});

// Add new sync function
function syncCurrentVideo() {
    // Force new sequence generation for the current channel
    lastGeneratedSeed = '';
    videoSequence = generateVideoSequence(generateSeed());
    calculateCumulativeTime();
    
    // Play the current video for this channel
    playVideoForCurrentBlock();
    
    // Show notification
    const currentVideo = videoSequence[currentIndex];
    if (currentVideo) {
        showChannelNotification(currentChannel, currentVideo.title);
    }
}

// Add new function to update mosaic content
async function updateMosaicContent() {
    const totalSeconds = getCurrentTimeInBlock();
    const grid = document.getElementById('thumbnailGrid');
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageVideos = gridVideos.slice(start, end);

    // Update current videos for visible channels only
    for (let i = start; i < end; i++) {
        const channel = i + 1;
        const channelSeed = generateSeed().replace(`ch${currentChannel}`, `ch${channel}`);
        const sequence = generateVideoSequence(channelSeed);
        
        // Calculate which video should be playing now
        let currentVideoIndex = 0;
        let cumulativeSeconds = 0;
        
        for (let j = 0; j < sequence.length; j++) {
            cumulativeSeconds += parseDuration(sequence[j].duration);
            if (totalSeconds < cumulativeSeconds) {
                currentVideoIndex = j;
                break;
            }
        }

        // Update the video in gridVideos
        gridVideos[i] = {
            ...sequence[currentVideoIndex],
            channel: channel
        };

        // Update only the visible thumbnail
        const thumbnailItem = grid.children[i - start];
        if (thumbnailItem) {
            const img = thumbnailItem.querySelector('img');
            const titleDiv = thumbnailItem.querySelector('.thumbnail-info div:last-child');
            const channelDiv = thumbnailItem.querySelector('.thumbnail-info div:first-child');
            
            // Only update if the content has changed
            if (img.src !== `https://img.youtube.com/vi/${sequence[currentVideoIndex].id}/mqdefault.jpg`) {
                img.src = `https://img.youtube.com/vi/${sequence[currentVideoIndex].id}/mqdefault.jpg`;
            }
            if (titleDiv.textContent !== sequence[currentVideoIndex].title) {
                titleDiv.textContent = sequence[currentVideoIndex].title;
            }
            if (channelDiv.textContent !== `Channel ${channel}`) {
                channelDiv.textContent = `Channel ${channel}`;
            }
        }
    }
}

// Add function to handle auto-hide toggle
function toggleAutoHide(enabled) {
    isAutoHideEnabled = enabled;
    if (enabled) {
        startAutoHideTimer();
    } else {
        clearAutoHideTimer();
        showButtonGroup();
    }
}

// Add function to start auto-hide timer
function startAutoHideTimer() {
    clearAutoHideTimer();
    autoHideTimeout = setTimeout(() => {
        if (isAutoHideEnabled) {
            hideButtonGroup();
        }
    }, 3000);
}

// Add function to clear auto-hide timer
function clearAutoHideTimer() {
    if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
        autoHideTimeout = null;
    }
}

// Add function to hide button group
function hideButtonGroup() {
    const buttonGroup = document.querySelector('.button-group');
    buttonGroup.classList.add('hidden');
}

// Add function to show button group
function showButtonGroup() {
    const buttonGroup = document.querySelector('.button-group');
    buttonGroup.classList.remove('hidden');
}

// Modify the mouse movement handler to handle both button group and icon
document.addEventListener('mousemove', () => {
    if (isAutoHideEnabled) {
        showButtonGroup();
        startAutoHideTimer();
    }
    if (isIconAutoHideEnabled) {
        showChannelIcon();
        startIconAutoHideTimer();
    }
});

// Add function to show channel icon
function showChannelIcon() {
    const channelIcon = document.getElementById('channelIcon');
    channelIcon.style.display = 'flex';
    channelIcon.style.transition = 'opacity 0.15s ease-in-out';
    // Force a reflow to ensure the transition works
    channelIcon.offsetHeight;
    channelIcon.style.opacity = '1';
}

// Add function to hide channel icon
function hideChannelIcon() {
    const channelIcon = document.getElementById('channelIcon');
    channelIcon.style.transition = 'opacity 0.15s ease-in-out';
    channelIcon.style.opacity = '0';
}

// Add function to handle icon auto-hide toggle
function toggleIconAutoHide(enabled) {
    isIconAutoHideEnabled = enabled;
    if (enabled) {
        startIconAutoHideTimer();
    } else {
        clearIconAutoHideTimer();
        showChannelIcon();
    }
}

// Add function to start icon auto-hide timer
function startIconAutoHideTimer() {
    clearIconAutoHideTimer();
    iconAutoHideTimeout = setTimeout(() => {
        if (isIconAutoHideEnabled) {
            hideChannelIcon();
        }
    }, 3000);
}

// Add function to clear icon auto-hide timer
function clearIconAutoHideTimer() {
    if (iconAutoHideTimeout) {
        clearTimeout(iconAutoHideTimeout);
        iconAutoHideTimeout = null;
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

// Add keyboard event listeners for arrow keys
document.addEventListener('keydown', (event) => {
    // Only handle arrow keys if we're not in mosaic view
    if (document.getElementById('gridView').style.display !== 'block') {
        if (event.key === 'ArrowLeft') {
            changeChannelBy(-1);
        } else if (event.key === 'ArrowRight') {
            changeChannelBy(1);
        }
    }
});

function updateChannelIcon(channelNumber) {
    const channelIcon = document.getElementById('channelIcon');
    
    // Make sure the icon is visible and has the correct display properties
    channelIcon.style.display = 'flex';
    channelIcon.style.opacity = '1';
    
    // Set base dimensions
    channelIcon.style.width = '100px';
    channelIcon.style.height = '100px';
    
    // Temporarily remove all transitions to force a reset
    channelIcon.style.transition = 'none';
    channelIcon.style.setProperty('--before-opacity', '1');
    channelIcon.style.setProperty('--after-opacity', '0');
    
    // Generate 4 random points for the polygon
    const maxOffset = 25;
    
    // Generate random offsets for each corner
    const topLeft = {
        x: Math.floor(Math.random() * maxOffset),
        y: Math.floor(Math.random() * maxOffset)
    };
    const topRight = {
        x: 100 - Math.floor(Math.random() * maxOffset),
        y: Math.floor(Math.random() * maxOffset)
    };
    const bottomRight = {
        x: 100 - Math.floor(Math.random() * maxOffset),
        y: 100 - Math.floor(Math.random() * maxOffset)
    };
    const bottomLeft = {
        x: Math.floor(Math.random() * maxOffset),
        y: 100 - Math.floor(Math.random() * maxOffset)
    };
    
    // Force a reflow to ensure the transition works
    channelIcon.offsetHeight;
    
    // Re-add the transition properties
    channelIcon.style.transition = 'clip-path 0.5s ease-in-out';
    
    // Create the clip-path polygon with CSS custom properties for animation
    channelIcon.style.setProperty('--top-left-x', `${topLeft.x}px`);
    channelIcon.style.setProperty('--top-left-y', `${topLeft.y}px`);
    channelIcon.style.setProperty('--top-right-x', `${topRight.x}px`);
    channelIcon.style.setProperty('--top-right-y', `${topRight.y}px`);
    channelIcon.style.setProperty('--bottom-right-x', `${bottomRight.x}px`);
    channelIcon.style.setProperty('--bottom-right-y', `${bottomRight.y}px`);
    channelIcon.style.setProperty('--bottom-left-x', `${bottomLeft.x}px`);
    channelIcon.style.setProperty('--bottom-left-y', `${bottomLeft.y}px`);
    
    // Apply the clip-path with CSS custom properties
    channelIcon.style.clipPath = `polygon(
        var(--top-left-x) var(--top-left-y),
        var(--top-right-x) var(--top-right-y),
        var(--bottom-right-x) var(--bottom-right-y),
        var(--bottom-left-x) var(--bottom-left-y)
    )`;
    
    // Try to fetch a random texture from TextureTown API
    fetch("https://textures.neocities.org/manifest.json")
        .then((res) => res.json())
        .then((json) => {
            // Get a random category
            const randomCategoryIndex = Math.floor(Math.random() * json.catalogue.length);
            const category = json.catalogue[randomCategoryIndex];
            
            // Get a random file from that category
            const randomFileIndex = Math.floor(Math.random() * category.files.length);
            const randomFile = category.files[randomFileIndex];
            
            // Create the full texture URL
            const textureURL = `${json.info.base_url}/${json.info.textures_folder}/${category.name}/${randomFile}`;
            
            // Create a new image to preload the texture
            const img = new Image();
            img.onload = () => {
                // Force a reflow to ensure the transition works
                channelIcon.offsetHeight;
                
                // Apply the new texture to the ::after pseudo-element
                channelIcon.style.setProperty('--after-bg', `url(${textureURL})`);
                channelIcon.style.setProperty('--after-bg-color', 'transparent');
                
                // Start both transitions at the same time
                requestAnimationFrame(() => {
                    channelIcon.style.setProperty('--after-opacity', '1');
                    channelIcon.style.setProperty('--before-opacity', '0');
                    
                    // After the transition, update the ::before element
                    setTimeout(() => {
                        channelIcon.style.setProperty('--before-bg', `url(${textureURL})`);
                        channelIcon.style.setProperty('--before-bg-color', 'transparent');
                        channelIcon.style.setProperty('--before-opacity', '1');
                        channelIcon.style.setProperty('--after-opacity', '0');
                    }, 500);
                });
            };
            img.src = textureURL;
        })
        .catch(() => {
            // Force a reflow to ensure the transition works
            channelIcon.offsetHeight;
            
            // Fallback to random color if API call fails
            const hue = Math.random() * 360;
            const saturation = Math.floor(Math.random() * 30) + 70;
            const lightness = Math.floor(Math.random() * 20) + 40;
            
            // Apply the new color to the ::after pseudo-element
            channelIcon.style.setProperty('--after-bg', 'none');
            channelIcon.style.setProperty('--after-bg-color', `hsl(${hue}, ${saturation}%, ${lightness}%)`);
            
            // Start both transitions at the same time
            requestAnimationFrame(() => {
                channelIcon.style.setProperty('--after-opacity', '1');
                channelIcon.style.setProperty('--before-opacity', '0');
                
                // After the transition, update the ::before element
                setTimeout(() => {
                    channelIcon.style.setProperty('--before-bg', 'none');
                    channelIcon.style.setProperty('--before-bg-color', `hsl(${hue}, ${saturation}%, ${lightness}%)`);
                    channelIcon.style.setProperty('--before-opacity', '1');
                    channelIcon.style.setProperty('--after-opacity', '0');
                }, 500);
            });
        });
}

function playVideo(videoId, channelNumber) {
    if (player && player.loadVideoById) {
        player.loadVideoById(videoId);
        currentChannel = channelNumber;
        updateChannelIcon(channelNumber);
        showChannelNotification(channelNumber, getVideoTitle(videoId));
        hideGrid();
    }
} 