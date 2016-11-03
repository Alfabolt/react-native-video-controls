import React, { Component } from 'react';
import Video from 'react-native-video';
import {
    TouchableWithoutFeedback,
    TouchableHighlight,
    PanResponder,
    StyleSheet,
    Touchable,
    Animated,
    Image,
    View,
    Text
} from 'react-native';
import _ from 'lodash';

export default class VideoPlayer extends Component {

    constructor( props ) {
        super( props );

        /**
         * All of our values that are updated by the
         * methods and listeners in this class
         */
        this.state = {
            // Video
            resizeMode: this.props.resizeMode || 'contain',
            paused: this.props.paused || false,
            muted: this.props.muted || false,
            volume: this.props.volume || 1,
            rate: this.props.rate || 1,

            // Controls
            isFullscreen: this.state.resizeMode === 'cover' || false,
            showTimeRemaining: true,
            showControls: true,
            lastScreenPress: 0,
            volumeFillWidth: 0,
            seekerFillWidth: 0,
            volumePosition: 0,
            seekerPosition: 0,
            volumeOffset: 0,
            seekerOffset: 0,
            seeking: false,
            loading: false,
            currentTime: 0,
            duration: 0,
        };

        /**
         * Any options that can be set at init.
         */
        this.opts = {
            playWhenInactive: this.props.playWhenInactive || false,
            playInBackground: this.props.playInBackground || false,
            repeat: this.props.repeat || false,
            title: this.props.title || '',
        };

        /**
         * Our app listeners and associated methods
         */
        this.events = {
            onLoadStart: this.props.onLoadStart || this._onLoadStart.bind( this ),
            onProgress: this.props.onProgress || this._onProgress.bind( this ),
            onError: this.props.onError || this._onError.bind( this ),
            onLoad: this.props.onLoad || this._onLoad.bind( this ),
            onEnd: this.props.onEnd || this._onEnd.bind( this ),
            onScreenPress: this._onScreenPress.bind( this ),
        };

        /**
         *
         */
        this.methods = {
            goBack: this.props.goBack || this._goBack.bind( this ),
            toggleFullscreen: this._toggleFullscreen.bind( this ),
            togglePlayPause: this._togglePlayPause.bind( this ),
            toggleControls: this._toggleControls.bind( this ),
            toggleTimer: this._toggleTimer.bind( this ),
        };

        /**
         * Player information
         */
        this.player = {
            volumePanResponder: PanResponder,
            seekPanResponder: PanResponder,
            controlTimeoutDelay: 10000,
            controlTimeout: null,
            volumeWidth: 150,
            seekWidth: 0,
            ref: Video,
        };

        /**
         *
         */
        this.animations = {
            bottomControl: {
                marginBottom: new Animated.Value( 0 ),
                opacity: new Animated.Value( 1 ),
            },
            topControl: {
                marginTop: new Animated.Value( 0 ),
                opacity: new Animated.Value( 1 ),
            },
            video: {
                opacity: new Animated.Value( 1 ),
            }
        };
    }



    /*------------------------------------------------------
    | Events
    |-------------------------------------------------------
    |
    | These are the events that the <Video> component uses
    | and can be overridden by assigning it as a prop.
    | It is suggested that you override onEnd.
    |
    */

    /**
     * When load starts we display a loading icon
     * and show the controls.
     */
    _onLoadStart() {

    }

    /**
     * When load is finished we hide the load icon
     * and hide the controls. We also set the
     * video duration.
     *
     * @param  data  The video meta data
     */
    _onLoad( data = {} ) {
        let state = this.state;

        state.duration = data.duration;
        state.loading = false;

        this.setState( state );

        if ( state.showControls ) {
            this.setControlTimeout();
        }
    }

    /**
     * For onprogress we fire listeners that
     * update our seekbar and timer.
     *
     * @param  data  The video meta data
     */
    _onProgress( data = {} ) {
        let state = this.state;
        state.currentTime = data.currentTime;

        if ( ! state.seeking ) {
            const position = this.calculateSeekerPosition();
            this.setSeekerPosition( position );
        }

        this.setState( state );
    }

    /**
     * It is suggested that you override this
     * command so your app knows what to do.
     * Either close the video or go to a
     * new page.
     */
    _onEnd() {}

    /**
     * Here we display a simple error saying
     * the video failed to load.
     */
    _onError() {
        // TODO
        // handle errors...
    }

    /**
     * This is a single and double tap listener
     * when the user taps the screen anywhere.
     * One tap toggles controls, two toggles
     * fullscreen mode.
     */
    _onScreenPress() {
        let state = this.state;
        const time = new Date().getTime();
        const delta =  time - state.lastScreenPress;

        if ( delta < 300 ) {
            this.methods.toggleFullscreen();
        }

        this.methods.toggleControls();
        state.lastScreenPress = time;
        this.setState( state );
    }



    /*------------------------------------------------------
    | Methods
    |-------------------------------------------------------
    |
    | These are all of our functions that interact with
    | various parts of the class. Anything from
    | calculating time remaining in a video
    | to handling control operations.
    |
    */

    /**
     * Set a timeout when the controls are shown
     * that hides them after a length of time.
     * Default is 15s
     */
    setControlTimeout() {
        this.player.controlTimeout = setTimeout( ()=> {
            this._hideControls.bind( this );
        }, this.player.controlTimeoutDelay );
    }

    /**
     * Clear the hide controls timeout.
     */
    clearControlTimeout() {
        clearTimeout( this.player.controlTimeout );
    }

    /**
     * Animation to hide controls. We fade the
     * display to 0 then move them off the
     * screen so they're not interactable
     */
    hideControlAnimation() {
        Animated.parallel([
            Animated.timing(
                this.animations.topControl.opacity,
                { toValue: 0 }
            ),
            Animated.timing(
                this.animations.topControl.marginTop,
                { toValue: -100 }
            ),
            Animated.timing(
                this.animations.bottomControl.opacity,
                { toValue: 0 }
            ),
            Animated.timing(
                this.animations.bottomControl.marginBottom,
                { toValue: -100 }
            ),
        ]).start();
    }

    /**
     * Animation to show controls...opposite of
     * above...move onto the screen and then
     * fade in.
     */
    showControlAnimation() {
        Animated.parallel([
            Animated.timing(
                this.animations.topControl.opacity,
                { toValue: 1 }
            ),
            Animated.timing(
                this.animations.topControl.marginTop,
                { toValue: 0 }
            ),
            Animated.timing(
                this.animations.bottomControl.opacity,
                { toValue: 1 }
            ),
            Animated.timing(
                this.animations.bottomControl.marginBottom,
                { toValue: 0 }
            ),
        ]).start();
    }

    /**
     * Function to hide the controls. Sets our
     * state then calls the animation.
     */
    _hideControls() {
        let state = this.state;
        state.showControls = false;
        this.hideControlAnimation();
        this.setState( state );
    }

    /**
     * Function to toggle controls based on
     * current state.
     */
    _toggleControls() {
        let state = this.state;
        state.showControls = ! state.showControls;

        if ( state.showControls ) {
            this.showControlAnimation();
            this.setControlTimeout();
        }
        else {
            this.hideControlAnimation();
            this.clearControlTimeout();
        }

        this.setState( state );
    }

    /**
     * Toggle fullscreen changes resizeMode on
     * the <Video> component then updates the
     * isFullscreen state.
     */
    _toggleFullscreen() {
        let state = this.state;
        state.isFullscreen = ! state.isFullscreen;
        state.resizeMode = state.isFullscreen === true ? 'cover' : 'contain';
        this.setState( state );
    }

    /**
     * Toggle playing state on <Video> component
     */
    _togglePlayPause() {
        let state = this.state;
        state.paused = ! state.paused;
        this.setState( state );
    }

    /**
     * Toggle between showing time remaining or
     * video duration in the timer control
     */
    _toggleTimer() {
        let state = this.state;
        state.showTimeRemaining = ! state.showTimeRemaining;
        this.setState( state );
    }

    /**
     * The default 'goback' function pops the navigator
     * and as such the video player requires a
     * navigator prop.
     */
    _goBack() {
        if ( this.props.navigator && this.props.navigator.pop ) {
            this.props.navigator.pop();
        }
        else {
            console.warn( '_goBack requires navigator property to function' );
        }
    }

    /**
     * Calculate the time to show in the timer area
     * based on if they want to see time remaining
     * or duration. Formatted to look as 00:00.
     */
    calculateTime() {
        if ( this.state.showTimeRemaining ) {
            const time = this.state.duration - this.state.currentTime;
            return `-${ this.formatTime( time ) }`;
        }
        return `${ this.formatTime( this.state.currentTime ) }`;
    }

    /**
     * Format a time string as mm:ss
     */
    formatTime( time = 0 ) {
        const symbol = this.state.showRemainingTime ? '-' : '';
        time = Math.min(
            Math.max( time, 0 ),
            this.state.duration
        );
        const minutes = time / 60;
        const seconds = time % 60;

        const formattedMinutes = _.padStart( minutes.toFixed( 0 ), 2, 0 );
        const formattedSeconds = _.padStart( seconds.toFixed( 0 ), 2 , 0 );

        return `${ symbol }${ formattedMinutes }:${ formattedSeconds }`;
    }

    /**
     * Set the position of the seekbar's components
     * (both fill and handle) according to the
     * position supplied.
     */
    setSeekerPosition( position = 0 ) {
        position = this.constrainToSeekerMinMax( position );
        let state = this.state;

        state.seekerFillWidth = position;
        state.seekerPosition = position;
        if ( ! state.seeking ) {
            state.seekerOffset = position;
        }

        this.setState( state );
    }

    /**
     * Contrain the value of the seeker to the min/max
     * value based on how big the seeker is.
     */
    constrainToSeekerMinMax( val = 0 ) {
        if ( val <= 0 ) {
            return 0;
        }
        else if ( val >= this.player.seekerWidth ) {
            return this.player.seekerWidth;
        }
        return val;
    }

    /**
     * Calculate the position that the seeker should be
     * at along its track.
     */
    calculateSeekerPosition() {
        const percent = this.state.currentTime / this.state.duration;
        return this.player.seekerWidth * percent;
    }

    /**
     * Return the time that the video should be at
     * based on where the seeker handle is.
     */
    calculateTimeFromSeekerPosition() {
        const percent = this.state.seekerPosition / this.player.seekerWidth;
        return this.state.duration * percent;
    }

    /**
     * Seek to a time in the video.
     */
    seekTo( time = 0 ) {
        let state = this.state;
        state.currentTime = time;
        this.player.ref.seek( time );
        this.setState( state );
    }

    /**
     * Set the position of the volume slider
     */
    setVolumePosition( position = 0 ) {
        let state = this.state;
        position = this.constrainToVolumeMinMax( position );
        state.volumePosition = position;
        state.volumeFillWidth = position;
        this.setState( state );
    }

    /**
     * Constrain the volume bar to the min/max of
     * its track's width.
     */
    constrainToVolumeMinMax( val = 0 ) {
        if ( val <= 0 ) {
            return 0;
        }
        else if ( val >= this.player.volumeWidth ) {
            return this.player.volumeWidth;
        }
        return val;
    }

    /**
     * Get the volume based on the position of the
     * volume object.
     */
    calculateVolumeFromVolumePosition() {
        return this.state.volumePosition / this.player.volumeWidth;
    }

    /**
     * Get the position of the volume handle based
     * on the volume
     */
    calculateVolumePositionFromVolume() {
        return this.player.volumeWidth / this.state.volume;
    }



    /*------------------------------------------------------
    | Init
    |-------------------------------------------------------
    |
    | Here we're initializing our listeners and getting
    | the component ready.
    |
    */

    /**
     * Before mounting init our seekbar and volume bar
     * pan responders.
     */
    componentWillMount() {
        this.initSeekPanResponder();
        this.initVolumePanResponder();
    }

    /**
     * Upon mounting, calculate the position of the volume
     * bar based on the volume property supplied to it.
     */
    componentDidMount() {
        const position = this.calculateVolumePositionFromVolume();
        let state = this.state;
        this.setVolumePosition( position );
        state.volumeOffset = position;
        this.setState( state );
    }

    /**
     * Get our seekbar responder going!
     */
    initSeekPanResponder() {
        this.player.seekPanResponder = PanResponder.create({
            onStartShouldSetPanResponder: ( evt, gestureState ) => true,
            onMoveShouldSetPanResponder: ( evt, gestureState ) => true,

            /**
             * When we start the pan tell the machine that we're
             * seeking. This stops it from updating the seekbar
             * position in the onProgress listener.
             */
            onPanResponderGrant: ( evt, gestureState ) => {
                let state = this.state;
                state.seeking = true;
                this.setState( state );
            },

            /**
             * When panning, update the seekbar position, duh.
             */
            onPanResponderMove: ( evt, gestureState ) => {
                const position = this.state.seekerOffset + gestureState.dx;
                this.setSeekerPosition( position );
            },

            /**
             * On release we update the time and seek to it in the video.
             * If you seek to the end of the video we fire the
             * onEnd callback
             */
            onPanResponderRelease: ( evt, gestureState ) => {
                let state = this.state;
                const time = this.calculateTimeFromSeekerPosition();
                state.seeking = false;
                this.seekTo( time );
                if ( time >= state.duration ) {
                    this.events.onEnd();
                }
                this.setState( state );
            }
        });
    }

    /**
     * Initialize the volume pan responder.
     */
    initVolumePanResponder() {
        this.player.volumePanResponder = PanResponder.create({
            onStartShouldSetPanResponder: ( evt, gestureState ) => true,
            onMoveShouldSetPanResponder: ( evt, gestureState ) => true,
            onPanResponderGrant: ( evt, gestureState ) => {},

            /**
             * Update the volume as we change the position.
             * If we go to 0 then turn on the mute prop
             * to avoid that weird static-y sound.
             */
            onPanResponderMove: ( evt, gestureState ) => {
                let state = this.state;

                const position = this.state.volumeOffset + gestureState.dx;
                this.setVolumePosition( position );
                state.volume = this.calculateVolumeFromVolumePosition();

                if ( state.volume <= 0 ) {
                    state.muted = true;
                }
                else {
                    state.muted = false;
                }

                this.setState( state );
            },

            /**
             * Update the offset...
             */
            onPanResponderRelease: ( evt, gestureState ) => {
                let state = this.state;
                state.volumeOffset = state.volumePosition;
                this.setState( state );
            }
        });
    }


    /*------------------------------------------------------
    | Rendering
    |-------------------------------------------------------
    |
    | This section contains all of our render methods.
    | In addition to the typical React render func
    | we also have all the render methods for
    | the controls.
    |
    */

    /**
     * Standard render control function that handles
     * everything except the sliders. Adds a
     * consistent <TouchableHighlight>
     * wrapper and styling.
     */
    renderControl( children, callback, style = {} ) {
        callback = callback || function() {
            console.warn( 'No callback supplied for this input' );
        };
        return (
            <TouchableHighlight
                underlayColor="transparent"
                activeOpacity={ 0.3 }
                onPress={ callback }
                style={[
                    styles.controls.control,
                    style
                ]}
            >
                { children }
            </TouchableHighlight>
        );
    }

    /**
     * Groups the top bar controls together in an animated
     * view and spaces them out.
     */
    renderTopControls() {
        return(
            <Animated.View style={[
                styles.controls.top,
                {
                    opacity: this.animations.topControl.opacity,
                    marginTop: this.animations.topControl.marginTop,
                }
            ]}>
                <View style={ styles.controls.row }>
                    { this.renderBack() }
                    <View style={ styles.controls.pullRight }>
                        { this.renderVolume() }
                        { this.renderFullscreen() }
                    </View>
                </View>
            </Animated.View>
        );
    }

    /**
     * Back button control
     */
    renderBack() {
        return this.renderControl(
            <Image
                source={ require( '../assets/img/video/back.png' ) }
                style={ styles.controls.back }
            />,
            this.methods.goBack,
            styles.controls.back
        );
    }

    /**
     * Render the volume slider and attach the pan handlers
     */
    renderVolume() {
        return (
            <View
                style={ styles.volume.track }
            >
                <View style={[
                    styles.volume.fill,
                    {
                        width: this.state.volumeFillWidth
                    }
                ]}>
                    <View
                        style={[
                            styles.volume.handle,
                            {
                                left: this.state.volumePosition
                            }
                        ]}
                        { ...this.player.volumePanResponder.panHandlers }
                    >
                        <Image style={ styles.volume.icon } source={ require( '../assets/img/video/volume.png' ) } />
                    </View>
                </View>
            </View>
        );
    }

    /**
     * Render fullscreen toggle and set icon based on the fullscreen state.
     */
    renderFullscreen() {
        let source = this.state.isFullscreen === true ? require( '../assets/img/video/shrink.png' ) : require( '../assets/img/video/expand.png' );
        return this.renderControl(
            <Image source={ source } />,
            this.methods.toggleFullscreen,
            styles.controls.fullscreen
        );
    }

    /**
     * Render bottom control group and wrap it in a holder
     */
    renderBottomControls() {
        return(
            <Animated.View style={[
                styles.controls.bottom,
                {
                    opacity: this.animations.bottomControl.opacity,
                    marginBottom: this.animations.bottomControl.marginBottom,
                }
            ]}>
                <View style={[
                    styles.controls.column,
                    styles.controls.seekbar
                ]}>
                    { this.renderSeekbar() }
                </View>
                <View style={ styles.controls.row }>
                    { this.renderPlayPause() }
                    { this.renderTitle() }
                    { this.renderTimer() }
                </View>
            </Animated.View>
        );
    }

    /**
     * Render the seekbar and attach its handlers
     */
    renderSeekbar() {
        return (
            <View
                style={ styles.seek.track }
                onLayout={ event => {
                    this.player.seekerWidth = event.nativeEvent.layout.width;
                }}
            >
                <View style={[
                    styles.seek.fill,
                    {
                        width: this.state.seekerFillWidth
                    }
                ]}>
                    <View
                        style={[
                            styles.seek.handle,
                            {
                                left: this.state.seekerPosition
                            }
                        ]}
                        { ...this.player.seekPanResponder.panHandlers }
                    >
                        <View style={ styles.seek.circle} />
                    </View>
                </View>
            </View>
        );
    }

    /**
     * Render the play/pause button and show the respective icon
     */
    renderPlayPause() {
        let source = this.state.paused === true ? require( '../assets/img/video/play.png' ) : require( '../assets/img/video/pause.png' );
        return this.renderControl(
            <Image source={ source } />,
            this.methods.togglePlayPause,
            styles.controls.playPause
        );
    }

    /**
     * Render our title...if supplied.
     */
    renderTitle() {
        if ( this.opts.title ) {
            return (
                <View style={[
                    styles.controls.control,
                    styles.controls.title,
                ]}>
                    <Text style={ styles.controls.text }>
                        { this.opts.title || '' }
                    </Text>
                </View>
            );
        }

        return null;
    }

    /**
     * Show our timer.
     */
    renderTimer() {
        return this.renderControl(
            <Text style={ styles.controls.text }>
                { this.calculateTime() }
            </Text>,
            this.methods.toggleTimer,
            styles.controls.timer
        );
    }

    /**
     * Provide all of our options and render the whole component.
     */
    render() {
        return (
            <TouchableWithoutFeedback
                onPress={ this.events.onScreenPress }
                style={ styles.player.container }
            >
                <View style={ styles.player.container }>
                    <Video
                        ref={ videoPlayer => this.player.ref = videoPlayer }

                        resizeMode={ this.state.resizeMode }
                        volume={ this.state.volume }
                        paused={ this.state.paused }
                        muted={ this.state.muted }
                        rate={ this.state.rate }

                        playInBackground={ this.opts.playInBackground }
                        playWhenInactive={ this.opts.playWhenInactive }
                        repeat={ this.opts.repeat }

                        onLoadStart={ this.events.onLoadStart }
                        onProgress={ this.events.onProgress }
                        onError={ this.events.onError }
                        onLoad={ this.events.onLoad }
                        onEnd={ this.events.onEnd }

                        style={ styles.player.video }

                        source={ this.props.source }
                    />
                    { this.renderTopControls() }
                    { this.renderBottomControls() }
                </View>
            </TouchableWithoutFeedback >
        );
    }
}

/**
 * This object houses our styles. There's player
 * specific styles and control specific ones.
 * And then there's volume/seeker styles.
 */
const styles = {
    player: StyleSheet.create({
        container: {
            flex: 1,
        },
        video: {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        },
    }),
    controls: StyleSheet.create({
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        column: {
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        control: {
            padding: 24,
        },
        text: {
            backgroundColor: 'transparent',
            color: '#FFF',
            fontSize: 16,
            textAlign: 'center',
        },
        pullRight: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        top: {
            flex: 1,
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            paddingTop: 28,
            height: 32,
        },
        bottom: {
            alignItems: 'stretch',
            flex: 2,
            height: 32,
            justifyContent: 'flex-end',
            paddingBottom: 8,
            marginLeft: 16,
            marginRight: 16,
        },
        seekbar: {
            zIndex: 100,
        },
        back: {},
        volume: {
            flexDirection: 'row',
        },
        fullscreen: {
            flexDirection: 'row',
        },
        seek: {},
        playPause: {
            width: 32,
        },
        title: {},
        timer: {
            width: 100,
        },
    }),
    seek: StyleSheet.create({
        track: {
            alignSelf: 'stretch',
            justifyContent: 'center',
            backgroundColor: '#333',
            height: 4,
            marginLeft: 20,
            marginRight: 20,
        },
        fill: {
            alignSelf: 'flex-start',
            backgroundColor: '#a6105e',
            height: 2,
            width: 1,
        },
        handle: {
            position: 'absolute',
            marginTop: -21,
            marginLeft: -24,
            padding: 16,
        },
        circle: {
            backgroundColor: '#a6105e',
            borderRadius: 20,
            height: 12,
            width: 12,
        },
    }),
    volume: StyleSheet.create({
        track: {
            justifyContent: 'center',
            backgroundColor: '#333',
            height: 2,
            marginLeft: 20,
            marginRight: 20,
            width: 150,
        },
        fill: {
            alignSelf: 'flex-start',
            backgroundColor: '#FFF',
            height: 2,
        },
        handle: {
            position: 'absolute',
            marginTop: -23,
            marginLeft: -24,
            padding: 16,
        },
        icon: {},
    })
};