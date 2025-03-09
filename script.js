// Global variables
let map;
let marker;
let userAcceptedPrivacy = false;
let isGoogleMapsLoaded = true;
let mapClickListener = null;
let reminderTimeout = null;
let isManualMarkingEnabled = false;
let mapInitialized = false;

// Browser feature detection
const supportsNotifications = 'Notification' in window;
const supportsGeolocation = 'geolocation' in navigator;

// Check for existing privacy preference and reminder
document.addEventListener('DOMContentLoaded', () => {
    // Setup mobile menu
    setupMobileMenu();
    
    // Clear search input
    document.getElementById('search-input').value = '';

    // Setup reminder toggle
    const reminderCheckbox = document.getElementById('enable-reminder');
    const reminderInput = document.getElementById('reminder-time');
    
    reminderCheckbox.addEventListener('change', () => {
        reminderInput.disabled = !reminderCheckbox.checked;
        // Announce change for screen readers
        const announcement = reminderCheckbox.checked ? 
            'Reminder enabled. You can now set a time.' : 
            'Reminder disabled.';
        announceForScreenReader(announcement);
    });

    userAcceptedPrivacy = localStorage.getItem('privacyAccepted') === 'true';
    if (userAcceptedPrivacy) {
        document.getElementById('privacy-banner').classList.add('hidden');
        initializeMap();
        checkExistingReminder();
    }
    
    // Setup smooth scrolling for anchor links
    setupSmoothScrolling();
    
    // Initialize lazy loading for the map
    setupLazyLoading();
    
    // Keyboard accessibility for buttons
    setupKeyboardAccessibility();
});

// Setup mobile menu
function setupMobileMenu() {
    const menuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (menuButton && mobileMenu) {
        menuButton.addEventListener('click', () => {
            const expanded = menuButton.getAttribute('aria-expanded') === 'true';
            menuButton.setAttribute('aria-expanded', !expanded);
            mobileMenu.classList.toggle('hidden');
            
            // Change icon based on state
            const icon = menuButton.querySelector('.material-icons');
            if (icon) {
                icon.textContent = expanded ? 'menu' : 'close';
            }
        });
    }
}

// Setup smooth scrolling for anchor links
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                // Close mobile menu if open
                document.getElementById('mobile-menu')?.classList.add('hidden');
                document.getElementById('mobile-menu-button')?.setAttribute('aria-expanded', 'false');
                
                // Scroll to target
                target.scrollIntoView({
                    behavior: 'smooth'
                });
                
                // Set focus to the target for accessibility
                target.setAttribute('tabindex', '-1');
                target.focus({preventScroll: true});
            }
        });
    });
}

// Lazy load the map when it's in viewport
function setupLazyLoading() {
    if ('IntersectionObserver' in window && !mapInitialized && !userAcceptedPrivacy) {
        const mapContainer = document.getElementById('map-container');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && userAcceptedPrivacy && !mapInitialized) {
                    initializeMap();
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        
        if (mapContainer) {
            observer.observe(mapContainer);
        }
    }
}

// Enhance keyboard accessibility
function setupKeyboardAccessibility() {
    // Add keyboard support for buttons
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                button.click();
            }
        });
    });
}

// Announce messages for screen readers
function announceForScreenReader(message) {
    let announcer = document.getElementById('sr-announcer');
    
    if (!announcer) {
        announcer = document.createElement('div');
        announcer.id = 'sr-announcer';
        announcer.setAttribute('aria-live', 'polite');
        announcer.classList.add('sr-only');
        document.body.appendChild(announcer);
    }
    
    announcer.textContent = message;
    
    // Clear after a delay to prevent multiple announcements from stacking
    setTimeout(() => {
        announcer.textContent = '';
    }, 3000);
}

// Check for existing reminder
function checkExistingReminder() {
    const savedLocation = localStorage.getItem('parkedLocation');
    if (savedLocation) {
        const parkingInfo = JSON.parse(savedLocation);
        
        // Show the find car button since we have a saved location
        const findButton = document.getElementById('find-location');
        findButton.classList.remove('hidden');
        findButton.style.display = 'flex';
        
        if (parkingInfo.reminderEnabled && parkingInfo.reminderTime) {
            const parkingTime = new Date(parkingInfo.timestamp).getTime();
            const reminderTime = parkingTime + (parkingInfo.reminderTime * 60 * 1000);
            const currentTime = new Date().getTime();

            if (currentTime >= reminderTime) {
                showReminderMessage();
            } else if (currentTime < reminderTime) {
                // Schedule the remaining time
                const remainingTime = reminderTime - currentTime;
                scheduleReminder(remainingTime / 60000); // Convert to minutes
                
                // Update checkbox and time input based on saved state
                document.getElementById('enable-reminder').checked = true;
                document.getElementById('reminder-time').disabled = false;
                document.getElementById('reminder-time').value = parkingInfo.reminderTime;
            }
        }
    }
}

// Show reminder message
function showReminderMessage() {
    if (supportsNotifications && Notification.permission === 'granted') {
        const notification = new Notification('Parking Reminder', {
            body: "Time's up! It's time to return to your car.",
            icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            badge: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            vibrate: [200, 100, 200],
            requireInteraction: true
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
            
            // Scroll to the map section
            document.getElementById('map-section').scrollIntoView({
                behavior: 'smooth'
            });
        };
    } else {
        showMessage("Reminder: It's time to return to your car!", 'info');
        // Also show an alert for more intrusive notification
        setTimeout(() => {
            alert("Time's up! It's time to return to your car.");
        }, 500);
    }
}

// Privacy banner handlers
document.getElementById('accept-privacy').addEventListener('click', () => {
    userAcceptedPrivacy = true;
    localStorage.setItem('privacyAccepted', 'true');
    
    const banner = document.getElementById('privacy-banner');
    banner.classList.add('fade-out');
    
    // Wait for fade animation
    setTimeout(() => {
        banner.classList.add('hidden');
        initializeMap();
    }, 300);
    
    announceForScreenReader('Privacy policy accepted. Map is now loading.');
});

document.getElementById('reject-privacy').addEventListener('click', () => {
    showMessage('This app requires location access to function. Without accepting the privacy policy, you cannot use the app.', 'error');
    announceForScreenReader('Privacy policy rejected. The app requires location access to function.');
});

// Search functionality
document.getElementById('search-button').addEventListener('click', searchLocation);
document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchLocation();
    }
});

// Function to get address from coordinates
async function getAddressFromCoordinates(position) {
    try {
        if (isGoogleMapsLoaded) {
            const geocoder = new google.maps.Geocoder();
            try {
                const result = await new Promise((resolve, reject) => {
                    geocoder.geocode({ location: position }, (results, status) => {
                        if (status === 'OK' && results[0]) {
                            resolve(results[0].formatted_address);
                        } else {
                            reject(new Error('Reverse geocoding failed'));
                        }
                    });
                });
                return result;
            } catch (error) {
                console.error('Reverse geocoding error:', error);
                return null;
            }
        } else {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}&addressdetails=1`);
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                return data.display_name;
            } catch (error) {
                console.error('OpenStreetMap reverse geocoding error:', error);
                return null;
            }
        }
    } catch (error) {
        console.error('Address lookup error:', error);
        return null;
    }
}

// Show/hide manual marking message
function toggleManualMarkingMessage(show) {
    const message = document.getElementById('manual-marking-message');
    if (show) {
        message.classList.remove('hidden');
        announceForScreenReader('Manual marking mode enabled. Click on the map to mark your parking spot.');
    } else {
        message.classList.add('hidden');
    }
}

// Enable manual marking mode
function enableManualMarking() {
    isManualMarkingEnabled = true;
    toggleManualMarkingMessage(true);
    
    // Update button text and style
    const markButton = document.getElementById('mark-location');
    markButton.innerHTML = '<span class="material-icons mr-2">cancel</span> Cancel Marking';
    markButton.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
    markButton.classList.add('bg-gray-600', 'hover:bg-gray-700');
    
    // Remove existing listener if any
    removeMapClickListener();

    // Add new click listener
    if (isGoogleMapsLoaded) {
        mapClickListener = map.addListener('click', (e) => {
            const pos = {
                lat: e.latLng.lat(),
                lng: e.latLng.lng()
            };
            handleParkingMarking(pos);
            disableManualMarking();
        });
    } else {
        mapClickListener = (e) => {
            const pos = {
                lat: e.latlng.lat,
                lng: e.latlng.lng
            };
            handleParkingMarking(pos);
            disableManualMarking();
        };
        map.on('click', mapClickListener);
    }
}

// Disable manual marking mode
function disableManualMarking() {
    isManualMarkingEnabled = false;
    toggleManualMarkingMessage(false);
    removeMapClickListener();
    
    // Reset button text and style
    const markButton = document.getElementById('mark-location');
    markButton.innerHTML = '<span class="material-icons mr-2">local_parking</span> Mark Parking Spot';
    markButton.classList.remove('bg-gray-600', 'hover:bg-gray-700');
    markButton.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
}

// Show message in the message area
function showMessage(message, type = 'error') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = message;
    messageEl.classList.remove('hidden', 'text-red-500', 'text-green-500', 'text-blue-500');
    
    switch(type) {
        case 'success':
            messageEl.classList.add('text-green-500');
            break;
        case 'info':
            messageEl.classList.add('text-blue-500');
            break;
        default:
            messageEl.classList.add('text-red-500');
    }
    
    // Announce for screen readers
    announceForScreenReader(message);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, 5000);
}

// Update handleLocationError function
function handleLocationError(browserHasGeolocation) {
    const message = browserHasGeolocation
        ? "Location access denied. Please enable it in your browser settings or click on the map to select manually."
        : "Error: Your browser doesn't support geolocation. Please search for your location or click on the map.";
    showMessage(message);
    enableManualMarking();
}

// Update error handling in searchLocation
async function searchLocation() {
    const searchInput = document.getElementById('search-input').value.trim();
    if (!searchInput) {
        showMessage('Please enter a location to search');
        return;
    }

    const loadingElement = document.getElementById('map-loading');
    loadingElement.classList.remove('hidden');
    loadingElement.innerHTML = '<span class="material-icons animate-spin">sync</span> Searching location...';

    try {
        let location;
        if (isGoogleMapsLoaded) {
            location = await searchGoogleMaps(searchInput);
        } else {
            location = await searchOpenStreetMap(searchInput);
        }

        if (location) {
            if (isGoogleMapsLoaded) {
                map.setCenter(location);
                map.setZoom(15); // Set consistent zoom level
            } else {
                map.setView([location.lat, location.lng], 15);
            }

            showMessage('Location found! Click on the map to mark your spot.', 'info');
            
            // Enable manual marking if no marker exists
            if (!marker) {
                enableManualMarking();
            }
        } else {
            showMessage('Location not found. Please try a different search term.');
        }
    } catch (error) {
        console.error('Search error:', error);
        showMessage('Error searching for location. Please try again.');
    } finally {
        loadingElement.classList.add('hidden');
    }
}

async function searchGoogleMaps(query) {
    const geocoder = new google.maps.Geocoder();
    try {
        const result = await new Promise((resolve, reject) => {
            geocoder.geocode({ address: query }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    resolve(results[0].geometry.location);
                } else {
                    reject(new Error('Geocoding failed'));
                }
            });
        });
        return result;
    } catch (error) {
        console.error('Google Geocoding error:', error);
        return null;
    }
}

async function searchOpenStreetMap(query) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
        return null;
    } catch (error) {
        console.error('OpenStreetMap search error:', error);
        return null;
    }
}

// Fallback to Leaflet if Google Maps fails to load
function loadLeaflet() {
    console.log('Google Maps failed to load, falling back to Leaflet');
    isGoogleMapsLoaded = false;
    
    if (userAcceptedPrivacy) {
        initializeMap();
    }
}

// Get location from IP
async function getLocationFromIP() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return {
            lat: data.latitude,
            lng: data.longitude
        };
    } catch (error) {
        console.error('Error getting location from IP:', error);
        // Fallback to a default location (London)
        return { lat: 51.5074, lng: -0.1278 };
    }
}

// Initialize the map
async function initializeMap() {
    if (!userAcceptedPrivacy) {
        return;
    }
    
    if (mapInitialized) {
        return;
    }
    
    mapInitialized = true;

    // Show loading message
    const loadingElement = document.getElementById('map-loading');
    loadingElement.innerHTML = '<span class="material-icons animate-spin">sync</span> Loading map...';
    
    try {
        // Get initial location from IP
        const initialLocation = await getLocationFromIP();
        
        if (isGoogleMapsLoaded) {
            initializeGoogleMaps(initialLocation);
        } else {
            initializeLeaflet(initialLocation);
        }
        
        // Hide loading message
        loadingElement.classList.add('hidden');
        announceForScreenReader('Map has loaded successfully.');
        
        // Try to get user's precise location
        if (supportsGeolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    
                    if (isGoogleMapsLoaded) {
                        map.setCenter(pos);
                        map.setZoom(15);
                    } else {
                        map.setView([pos.lat, pos.lng], 15);
                    }

                    // If there's a saved location, show it
                    const savedLocation = localStorage.getItem('parkedLocation');
                    if (savedLocation) {
                        const savedPos = JSON.parse(savedLocation);
                        if (savedPos.position) {
                            updateMarker(savedPos.position);
                            
                            // Update the location details with saved information
                            updateLocationDetails(savedPos);
                        }
                    }
                },
                () => {
                    handleLocationError(true);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            handleLocationError(false);
        }
    } catch (error) {
        console.error('Error initializing map:', error);
        loadingElement.textContent = 'Error loading map';
        showMessage('Error loading map. Please refresh the page and try again.', 'error');
    }
}

// Initialize Google Maps
function initializeGoogleMaps(initialLocation) {
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        center: initialLocation,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ]
    });
}

// Initialize Leaflet
function initializeLeaflet(initialLocation) {
    map = L.map('map').setView([initialLocation.lat, initialLocation.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

// Event listeners for buttons
document.getElementById('mark-location').addEventListener('click', function() {
    if (isManualMarkingEnabled) {
        disableManualMarking();
    } else {
        markParking();
    }
});
document.getElementById('find-location').addEventListener('click', findParking);
document.getElementById('clear-location').addEventListener('click', clearParking);

// Update the markParking function
async function markParking() {
    if (!userAcceptedPrivacy) {
        showMessage('Please accept the privacy policy to use this feature.', 'error');
        return;
    }

    if (supportsGeolocation) {
        // Show loading state
        const markButton = document.getElementById('mark-location');
        const originalText = markButton.innerHTML;
        markButton.innerHTML = '<span class="material-icons animate-spin mr-2">sync</span> Getting Location...';
        markButton.disabled = true;
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                handleParkingMarking(pos);
                
                // Reset button state
                markButton.innerHTML = originalText;
                markButton.disabled = false;
            },
            (error) => {
                console.error('Geolocation permission denied:', error);
                showMessage('Location access denied. Please use the map to select your parking spot manually.', 'error');
                enableManualMarking();
                
                // Reset button state
                markButton.innerHTML = originalText;
                markButton.disabled = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        console.error('Geolocation not supported');
        showMessage('Your browser doesn\'t support geolocation. Please use the map to select your parking spot manually.', 'error');
        enableManualMarking();
    }
}

// Update the findParking function to include directions
function findParking() {
    const savedLocationJson = localStorage.getItem('parkedLocation');
    
    if (!savedLocationJson) {
        showMessage('No parking location saved!', 'error');
        return;
    }

    const savedLocation = JSON.parse(savedLocationJson);
    if (!savedLocation.position) {
        showMessage('Invalid parking location data. Please mark your spot again.', 'error');
        return;
    }

    const pos = savedLocation.position;

    if (supportsGeolocation) {
        // Show loading state
        const findButton = document.getElementById('find-location');
        findButton.disabled = true;
        findButton.innerHTML = '<span class="material-icons animate-spin mr-2">sync</span> Getting your location...';

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const currentPos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                // Open Google Maps directions in a new tab
                const url = `https://www.google.com/maps/dir/?api=1&origin=${currentPos.lat},${currentPos.lng}&destination=${pos.lat},${pos.lng}&travelmode=walking`;
                window.open(url, '_blank');

                // Also update the map view
                if (isGoogleMapsLoaded) {
                    map.setCenter(pos);
                    map.setZoom(18);
                } else {
                    map.setView([pos.lat, pos.lng], 18);
                }
                updateMarker(pos);
                showMessage('Directions opened in a new tab!', 'success');

                // Reset button state
                findButton.disabled = false;
                findButton.innerHTML = '<span class="material-icons mr-2">directions_car</span> Find My Car';
            },
            (error) => {
                console.error('Geolocation error:', error);
                showMessage('Unable to get directions without location access. Please enable location services in your browser settings.', 'error');
                // Reset button state
                findButton.disabled = false;
                findButton.innerHTML = '<span class="material-icons mr-2">directions_car</span> Find My Car';
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        showMessage('Unable to get directions - your browser doesn\'t support geolocation.', 'error');
    }
}

// Update the clearParking function
function clearParking() {
    localStorage.removeItem('parkedLocation');
    if (marker) {
        if (isGoogleMapsLoaded) {
            marker.setMap(null);
        } else {
            map.removeLayer(marker);
        }
        marker = null;
    }
    document.getElementById('location-details').innerHTML = '<p>No parking spot saved</p>';
    
    // Reset the find button
    const findButton = document.getElementById('find-location');
    findButton.classList.add('hidden');
    findButton.style.display = 'none';
    
    // Reset reminder settings
    document.getElementById('enable-reminder').checked = false;
    document.getElementById('reminder-time').disabled = true;
    document.getElementById('reminder-time').value = 30;
    
    // Clear any existing reminder
    if (reminderTimeout) {
        clearTimeout(reminderTimeout);
        reminderTimeout = null;
    }
    
    showMessage('Parking location cleared successfully!', 'success');
}

// Update marker on the map
function updateMarker(position) {
    if (marker) {
        if (isGoogleMapsLoaded) {
            marker.setMap(null);
        } else {
            map.removeLayer(marker);
        }
    }

    if (isGoogleMapsLoaded) {
        marker = new google.maps.Marker({
            position: position,
            map: map,
            title: 'Your Parking Spot',
            animation: google.maps.Animation.DROP
        });
    } else {
        marker = L.marker([position.lat, position.lng])
            .addTo(map)
            .bindPopup('Your Parking Spot');
    }
}

// Update location details display
function updateLocationDetails(parkingInfo) {
    if (!parkingInfo) return;
    
    const timeFormatted = new Date(parkingInfo.timestamp).toLocaleString();
    let reminderText = '';
    
    if (parkingInfo.reminderEnabled && parkingInfo.reminderTime) {
        const reminderTime = new Date(new Date(parkingInfo.timestamp).getTime() + (parkingInfo.reminderTime * 60 * 1000));
        reminderText = `<p class="text-blue-600">Reminder set for: ${reminderTime.toLocaleTimeString()}</p>`;
    }
    
    document.getElementById('location-details').innerHTML = `
        <div class="space-y-2">
            <p class="font-medium text-gray-900">Parking spot saved at:</p>
            <p class="text-gray-600">${parkingInfo.address || 'Address not available'}</p>
            <p class="text-gray-500">Time: ${timeFormatted}</p>
            ${reminderText}
        </div>
    `;
}

// Update scheduleReminder function
function scheduleReminder(minutes) {
    // Clear any existing reminder
    if (reminderTimeout) {
        clearTimeout(reminderTimeout);
    }

    // Request notification permission if needed
    if (supportsNotifications) {
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    reminderTimeout = setTimeout(() => {
        showReminderMessage();
    }, minutes * 60 * 1000);
}

// Remove map click listener
function removeMapClickListener() {
    if (mapClickListener) {
        if (isGoogleMapsLoaded) {
            google.maps.event.removeListener(mapClickListener);
        } else {
            map.off('click', mapClickListener);
        }
        mapClickListener = null;
    }
}

// Handle parking marking
async function handleParkingMarking(pos) {
    // Immediately update map view and marker
    if (isGoogleMapsLoaded) {
        map.setCenter(pos);
        map.setZoom(15); // Consistent zoom level
    } else {
        map.setView([pos.lat, pos.lng], 15);
    }
    updateMarker(pos);

    // Immediately show initial UI update with loading state
    document.getElementById('location-details').innerHTML = `
        <div class="space-y-2">
            <p class="font-medium text-gray-900">Parking spot saved!</p>
            <p class="text-gray-600">Time: ${new Date().toLocaleString()}</p>
            <p class="text-gray-500">Getting address...</p>
        </div>
    `;
    
    // Show Find My Car button
    const findButton = document.getElementById('find-location');
    findButton.classList.remove('hidden');
    findButton.style.display = 'flex';

    // Get reminder settings
    const reminderEnabled = document.getElementById('enable-reminder').checked;
    const reminderTime = parseInt(document.getElementById('reminder-time').value, 10);

    // Save initial parking information
    const parkingInfo = {
        position: pos,
        address: 'Getting address...',
        timestamp: new Date().toISOString(),
        reminderEnabled: reminderEnabled,
        reminderTime: reminderTime
    };
    
    localStorage.setItem('parkedLocation', JSON.stringify(parkingInfo));

    // Schedule reminder if enabled
    if (reminderEnabled && reminderTime > 0) {
        scheduleReminder(reminderTime);
        showMessage(`Reminder set for ${reminderTime} minutes from now.`, 'success');
    }

    // Get address in background and update UI when available
    getAddressFromCoordinates(pos).then(address => {
        if (address) {
            parkingInfo.address = address;
            localStorage.setItem('parkedLocation', JSON.stringify(parkingInfo));
            
            updateLocationDetails(parkingInfo);
        }
    }).catch(error => {
        console.error('Error getting address:', error);
        document.getElementById('location-details').innerHTML = `
            <div class="space-y-2">
                <p class="font-medium text-gray-900">Parking spot saved</p>
                <p class="text-red-500">Unable to get address</p>
                <p class="text-gray-500">Time: ${new Date().toLocaleString()}</p>
            </div>
        `;
    });
    
    // Announce for screen readers
    announceForScreenReader('Parking spot marked successfully.');
} 