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
    const blockStart = Math.floor((hours * 60 + minutes) / 120) * 120; // Round down to nearest 120 minutes
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
        currentChannel = parseInt(savedChannel);  // Make sure it's a number
        const select = document.getElementById('channelSelect');
        
        // Add the channel option if it doesn't exist
        if (!select.querySelector(`option[value="${currentChannel}"]`)) {
            const option = document.createElement('option');
            option.value = currentChannel;
            option.text = `Channel ${currentChannel}`;
            select.add(option);
        }
        
        select.value = currentChannel;
    }
    
    await fetchVideoList();
    playVideoForCurrentBlock();
    showUnmutePrompt();
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
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        panel.style.opacity = '1';
    } else {
        panel.style.opacity = '0';
        setTimeout(() => {
            panel.style.display = 'none';
        }, 300); // Wait for fade out animation
    }
}

// Modify the changeChannelBy function
function changeChannelBy(delta) {
    const select = document.getElementById('channelSelect');
    const currentValue = parseInt(select.value);
    let newValue;
    
    if (delta > 0) {
        newValue = currentValue + 1;
        if (newValue > 999) newValue = 0; // Changed to include 0
    } else {
        newValue = currentValue - 1;
        if (newValue < 0) newValue = 999;
    }
    
    currentChannel = newValue;
    
    if (!select.querySelector(`option[value="${newValue}"]`)) {
        const option = document.createElement('option');
        option.value = newValue;
        option.text = `Channel ${newValue}`;
        select.add(option);
    }
    select.value = newValue;
    
    localStorage.setItem('selectedChannel', currentChannel);
    
    lastGeneratedSeed = '';
    playVideoForCurrentBlock();
    updateCurrentInfo();
    
    const currentVideo = videoSequence[currentIndex];
    showChannelNotification(currentChannel, currentVideo.title);
}

function showChannelNotification(channelNumber, videoTitle) {
    const notification = document.getElementById('channelNotification');
    const titleElement = document.getElementById('channelTitle');
    const videoTitleElement = document.getElementById('channelVideoTitle');
    
    // Clear any existing timeouts
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    
    // Update content
    titleElement.textContent = `Channel ${channelNumber}`;
    videoTitleElement.textContent = videoTitle;
    
    // Force full opacity before showing
    notification.style.opacity = '1';
    notification.style.display = 'block';
    
    // Keep full opacity for 1 second, then start fade out
    notificationTimeout = setTimeout(() => {
        notification.style.opacity = '1';
        
        // Start fade out after 1 more second
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 300);
        }, 1000);
    }, 1000);
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
    
    // Set new interval
    mosaicRefreshInterval = setInterval(() => {
        if (document.getElementById('gridView').style.display === 'block') {  // Only refresh if mosaic is visible
            updateMosaicContent();
        }
    }, 5000); // 5 seconds
}

// Add new function to update mosaic content
async function updateMosaicContent() {
    const now = new Date();
    const currentMinute = now.getMinutes();
    const blockStart = Math.floor(currentMinute / 10) * 10;
    const totalSeconds = (currentMinute - blockStart) * 60 + now.getSeconds();

    // Update current videos for all channels
    for (let i = 0; i < gridVideos.length; i++) {
        const channel = i + 1;
        const channelSeed = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${blockStart}-ch${channel}`;
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
    }
    
    // Refresh current page without changing page number
    displayCurrentPage();
}

// Modify loadGridView to use the new refresh system
async function loadGridView() {
    const playerView = document.getElementById('player');
    const gridView = document.getElementById('gridView');
    playerView.style.display = 'none';
    gridView.style.display = 'block';
    
    // Update itemsPerPage based on screen size
    itemsPerPage = calculateItemsPerPage();
    
    // Initialize gridVideos array
    gridVideos = [];
    const now = new Date();
    const currentMinute = now.getMinutes();
    const blockStart = Math.floor(currentMinute / 10) * 10;
    const totalSeconds = (currentMinute - blockStart) * 60 + now.getSeconds();

    // Generate sequences for channels 1-999
    for (let channel = 1; channel <= 999; channel++) {
        const channelSeed = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${blockStart}-ch${channel}`;
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
    
    grid.innerHTML = pageVideos.map(video => `
        <div class="thumbnail-item" onclick="playFromGrid('${video.id}', ${video.channel})">
            <img src="https://img.youtube.com/vi/${video.id}/mqdefault.jpg" alt="${video.title}">
            <div class="thumbnail-info">
                <div style="font-size: 1.2em; margin-bottom: 4px;">Channel ${video.channel}</div>
                <div style="font-size: 0.9em; opacity: 0.8;">${video.title}</div>
            </div>
        </div>
    `).join('');
    
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

function playFromGrid(videoId, channel) {
    // Stop the refresh interval
    if (mosaicRefreshInterval) {
        clearInterval(mosaicRefreshInterval);
    }
    
    // Update channel
    currentChannel = channel;
    const select = document.getElementById('channelSelect');
    
    // Add channel option if it doesn't exist
    if (!select.querySelector(`option[value="${channel}"]`)) {
        const option = document.createElement('option');
        option.value = channel;
        option.text = `Channel ${channel}`;
        select.add(option);
    }
    
    // Update select and localStorage
    select.value = channel;
    localStorage.setItem('selectedChannel', channel);
    
    // Switch back to player view
    const playerView = document.getElementById('player');
    const gridView = document.getElementById('gridView');
    playerView.style.display = 'block';
    gridView.style.display = 'none';
    
    // Force new sequence generation for the selected channel
    lastGeneratedSeed = '';
    videoSequence = generateVideoSequence(generateSeed());
    calculateCumulativeTime();
    
    // Play the current video for this channel
    playVideoForCurrentBlock();
    
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