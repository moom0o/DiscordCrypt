//META{"name":"discordCrypt"}*//

/*******************************************************************************
 * MIT License
 *
 * Copyright (c) 2018 Leonardo Gates
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 ******************************************************************************/

"use strict";

/**
 * @public
 * @desc Main plugin prototype.
 */
class discordCrypt {
    /* ============================================================== */

    /**
     * @public
     * @desc Returns the name of the plugin.
     * @returns {string}
     */
    getName() {
        return 'DiscordCrypt';
    }

    /**
     * @public
     * @desc Returns the description of the plugin.
     * @returns {string}
     */
    getDescription() {
        return 'Provides secure messaging for Discord using various cryptography standards.';
    }

    /**
     * @public
     * @desc Returns the plugin's original author.
     * @returns {string}
     */
    getAuthor() {
        return 'Leonardo Gates';
    }

    /**
     * @public
     * @desc Returns the current version of the plugin.
     * @returns {string}
     */
    getVersion() {
        return '1.0.10';
    }

    /* ============================================================== */

    /**
     * @public
     * @desc Initializes an instance of DiscordCrypt.
     * @example
     * let instance = new discordCrypt();
     */
    constructor() {

        /* ============================================ */

        /**
         * Discord class names that changes ever so often because they're douches.
         * These will usually be the culprit if the plugin breaks.
         */

        /**
         * @desc Used to scan each message for an embedded descriptor.
         * @type {string}
         */
        this.messageMarkupClass = '.markup';
        /**
         * @desc Used to find the search toolbar to inject all option buttons.
         * @type {string}
         */
        this.searchUiClass = '.search .search-bar';
        /**
         * @desc Used to hook messages being sent.
         * @type {string}
         */
        this.channelTextAreaClass = '.content textarea';
        /**
         * @desc Used to detect if the autocomplete dialog is opened.
         * @type {string}
         */
        this.autoCompleteClass = '.autocomplete-1vrmpx';

        /* ============================================ */

        /**
         * @desc Defines what an encrypted message starts with. Must be 4x UTF-16 bytes.
         * @type {string}
         */
        this.encodedMessageHeader = "⢷⢸⢹⢺";

        /**
         * @desc Defines what a public key message starts with. Must be 4x UTF-16 bytes.
         * @type {string}
         */
        this.encodedKeyHeader = "⢻⢼⢽⢾";

        /**
         * @desc Defines what the header of an encrypted message says.
         * @type {string}
         */
        this.messageHeader = '-----ENCRYPTED MESSAGE-----';

        /**
         * @desc Master database password. This is a Buffer() containing a 256-bit key.
         * @type {Buffer|null}
         */
        this.masterPassword = null;

        /**
         * @desc Message scanning interval handler's index. Used to stop any running handler.
         * @type {int}
         */
        this.scanInterval = undefined;

        /**
         * @desc The index of the handler used to reload the toolbar.
         * @type {int}
         */
        this.toolbarReloadInterval = undefined;

        /**
         * @desc The index of the handler used for automatic update checking.
         * @type {int}
         */
        this.updateHandlerInterval = undefined;

        /**
         * @desc The configuration file currently in use. Only valid after decryption of the configuration database.
         * @type {Object|null}
         */
        this.configFile = null;

        /**
         * @desc The main message dispatcher used by Discord. Resolved upon startup.
         * @type {Object|null}
         */
        this.messageDispatcher = null;

        /**
         * @typedef function EventHandler
         * @typedef string EventName
         * @typedef {{EventName: EventHandler}} EventDefinition
         */

        /**
         * @desc Indexes of each dual-symmetric encryption mode.
         * @type {int[]}
         */
        this.encryptModes = [
            /* Blowfish(Blowfish, AES, Camellia, IDEA, TripleDES) */
            0, 1, 2, 3, 4,
            /* AES(Blowfish, AES, Camellia, IDEA, TripleDES) */
            5, 6, 7, 8, 9,
            /* Camellia(Blowfish, AES, Camellia, IDEA, TripleDES) */
            10, 11, 12, 13, 14,
            /* IDEA(Blowfish, AES, Camellia, IDEA, TripleDES) */
            15, 16, 17, 18, 19,
            /* TripleDES(Blowfish, AES, Camellia, IDEA, TripleDES) */
            20, 21, 22, 23, 24
        ];

        /**
         * @desc Symmetric block modes of operation.
         * @type {string[]}
         */
        this.encryptBlockModes = [
            'CBC', /* Cipher Block-Chaining */
            'CFB', /* Cipher Feedback Mode */
            'OFB', /* Output Feedback Mode */
        ];

        /**
         * @desc Shorthand padding modes for block ciphers referred to in the code.
         * @type {string[]}
         */
        this.paddingModes = [
            'PKC7', /* PKCS #7 */
            'ANS2', /* ANSI X.923 */
            'ISO1', /* ISO-10126 */
            'ISO9', /* ISO-97972 */
        ];

        /**
         * @desc Defines the CSS for the application overlays.
         * @type {string}
         */
        this.appCss = `
            a#inbrowserbtn.btn{ display: none }
            .dc-overlay {
                position: fixed;
                font-family: monospace;
                display: none;
                width: 100%;
                height: 100%;
                left: 0;
                bottom: 0;
                right: 0;
                top: 0;
                z-index: 1000;
                cursor: default;
                transform: translateZ(0px);
                background: rgba(0, 0, 0, 0.85) !important;
            }
            .dc-password-field {
                width: 95%;
                margin: 10px;
                color: #ffffff;
                height: 10px;
                padding: 5px;
                background-color: #000000;
                border: 2px solid #3a71c1;
            }
            .dc-overlay-centerfield {
                position: absolute;
                top: 35%;
                left: 50%;
                font-size: 20px;
                color: #ffffff;
                padding: 16px;
                border-radius: 20px;
                background: rgba(0, 0, 0, 0.7);
                transform: translate(-50%, 50%);
            }
            .dc-overlay-main {
                overflow: hidden;
                position: absolute;
                left: 5%; right: 5%;
                top: 5%; bottom: 5%;
                width: 90%; height: 90%;
                border: 3px solid #3f3f3f;
                border-radius: 3px;
            }
            .dc-textarea {
                font-family: monospace;
                font-size: 12px;
                color: #ffffff;
                background: #000;
                overflow: auto;
                padding: 5px;
                resize: none;
                height: 100%;
                width: 100%;
                margin: 2px;           
            }
            .dc-update-field {
                font-size: 14px;
                margin: 10px;
            }
            ul.dc-list {
                margin: 10px;
                padding: 5px;
                list-style-type: circle;
            }
            ul.dc-list > li { padding: 5px; }
            ul.dc-list-red { color: #ff0000; }
            .dc-overlay-main textarea {
                background: transparent !important;
                cursor: default;
                font-size: 12px;
                padding: 5px;
                margin-top: 10px;
                border-radius: 2px;
                resize: none;
                color: #8e8e8e;
                width: 70%;
                overflow-y: hidden;
                user-select: none;
            }
            .dc-overlay-main select {
                background-color: transparent;
                border-radius: 3px;
                font-size: 12px;
                color: #fff;
            }
            .dc-overlay-main select:hover {
                background-color: #000 !important;
                color: #fff;
            }
            .dc-input-field {
                font-family: monospace !important;
                background: #000 !important;
                color: #fff !important;
                border-radius: 3px;
                font-size: 12px;
                width: 40%;
                margin-bottom: 10px;
                margin-top: -5px;
                margin-left: 10%;
            }
            .dc-input-label {
                font-family: monospace !important;
                color: #708090;
                min-width: 20%;
            }
            .dc-ruler-align {
                display: flex;
                margin: 10px;
            }
            .dc-code-block {
                font-family: monospace !important;
                font-size: 0.875rem;
                line-height: 1rem;
                
                overflow-x: visible;
                text-indent: 0;
                
                background: rgba(0,0,0,0.42)!important;
                color: hsla(0,0%,100%,0.7)!important;
                padding: 6px!important;
                
                position: relative;            
            }
            .dc-overlay-main .tab {
                overflow: hidden;
                background-color: rgba(0, 0, 0, .9) !important;
                border-bottom: 3px solid #3f3f3f;
            }
            .dc-overlay-main .tab button {
                color: #008000;
                background-color: inherit;
                cursor: pointer;
                padding: 14px 14px;
                font-size: 14px;
                transition: 0.5s;
                font-family: monospace;
                border-radius: 3px;
                margin: 3px;
            }
            .dc-overlay-main .tab button:hover {
                background-color: #515c6b;
            }
            .dc-overlay-main .tab button.active {
                background-color: #1f1f2b;
            }
            .dc-overlay-main .tab-content {
                display: none;
                height: 95%;
                color: #9298a2;
                overflow: auto;
                padding: 10px 25px 5px;
                animation: fadeEffect 1s;
                background: rgba(0, 0, 0, 0.7) !important;
            }
            .dc-main-overlay .tab-content .dc-hint {
                margin: 14px;
                padding-left: 5px;
                font-size: 12px;
                color: #f08080;
            }
            .dc-svg { 
                color: #fff; opacity: .6;
                margin: 0 4px;
                cursor: pointer;
                width: 24px;
                height: 24px;
            }
            .dc-svg:hover {
                color: #fff; opacity: .8;
            }
            .dc-button{
                margin-right: 5px;
                margin-left: 5px;
                background-color: #7289da;
                color: #fff;
                align-items: center;
                border-radius: 3px;
                box-sizing: border-box;
                display: flex;
                font-size: 14px;
                width: auto;
                height: 32px;
                min-height: 32px;
                min-width: 60px;
                font-weight: 500;
                justify-content: center;
                line-height: 16px;
                padding: 2px 16px;
                position: relative;
                user-select: none;  
            }
            .dc-button:hover{ background-color: #677bc4 !important; }
            .dc-button:active{ background-color: #5b6eae !important; }
            .dc-button-inverse{
                color: #f04747;
                background: transparent !important;
                border: 1px solid rgba(240,71,71,.3);
                transition: color .17s ease,background-color .17s ease,border-color .17s ease;
            }
            .dc-button-inverse:hover{
                border-color: rgba(240,71,71,.6);
                background: transparent !important;
            }
            .dc-button-inverse:active{ background-color: rgba(240,71,71,.1); }
            .stat-levels {
                box-shadow: inset 0 0 25px rgba(0,0,0,.5);
                margin: 5px auto 0 auto;
                height: 20px;
                padding: 15px;
                border: 1px solid #494a4e;
                border-radius: 10px;
                background: linear-gradient(#444549 0%, #343539 100%);
            }
            .stat-bar {
                background-color: #2a2b2f;
                box-shadow: inset 0 5px 15px rgba(0,0,0,.6);
                height: 8px;
                overflow: hidden;
                padding: 3px;
                border-radius: 3px;
                margin-bottom: 10px;
                margin-top: 10px;
                margin-left: 0;
            }
            .stat-bar-rating {
                border-radius: 4px;
                float: left;
                height: 100%;
                font-size: 12px;
                color: #ffffff;
                text-align: center;
                text-indent: -9999px;
                background-color: #3a71c1;
                box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.15);
            }
            .stat-bar-rating { @include stat-bar(#cf3a02, #ff4500, top, bottom); }
            `;

        /**
         * @desc Contains the raw HTML used to inject into the search descriptor providing menu icons.
         * @type {string}
         */
        this.toolbarHtml =
            `
            <button type="button" id="dc-clipboard-upload-btn" style="background-color: transparent;"
                title="Upload Encrypted Clipboard">
                <svg x="0px" y="0px" width="30" height="30" viewBox="0 0 18 18" class="dc-svg"> 
                        <path fill="lightgrey"
                            d="M13 4h-3v-4h-10v14h6v2h10v-9l-3-3zM3 1h4v1h-4v-1zM15 
                            15h-8v-10h5v3h3v7zM13 7v-2l2 2h-2z"/>
                </svg>
            </button>
            <button type="button" id="dc-file-btn" style="background-color: transparent;" title="Upload Encrypted File">
                <svg class="dc-svg" width="24" height="24" viewBox="0 0 1792 1792" fill="lightgrey">
                    <path d="M768 384v-128h-128v128h128zm128 128v-128h-128v128h128zm-128 
                        128v-128h-128v128h128zm128 128v-128h-128v128h128zm700-388q28 28 48 
                        76t20 88v1152q0 40-28 68t-68 28h-1344q-40 0-68-28t-28-68v-1600q0-40 28-68t68-28h896q40 
                        0 88 20t76 48zm-444-244v376h376q-10-29-22-41l-313-313q-12-12-41-22zm384 1528v-1024h-416q-40 
                        0-68-28t-28-68v-416h-128v128h-128v-128h-512v1536h1280zm-627-721l107 349q8 27 8 52 0 83-72.5 
                        137.5t-183.5 54.5-183.5-54.5-72.5-137.5q0-25 8-52 21-63 120-396v-128h128v128h79q22 0 39 
                        13t23 34zm-141 465q53 0 90.5-19t37.5-45-37.5-45-90.5-19-90.5 19-37.5 45 37.5 45 90.5 19z">
                    </path>
                </svg>           
            </button>
            <button type="button" id="dc-settings-btn" style="background-color: transparent;" 
                title="DiscordCrypt Settings">
                <svg class="dc-svg" enable-background="new 0 0 32 32" version="1.1" viewBox="0 0 32 32" 
                width="20px" height="20px" xml:space="preserve">
                    <g>
                        <path fill="lightgrey" d="M28,10H18v2h10V10z M14,10H4v10h10V10z M32,0H0v28h15.518c1.614,2.411,
                        4.361,3.999,7.482,4c4.971-0.002,8.998-4.029,9-9   
                        c0-0.362-0.027-0.718-0.069-1.069L32,22V0z M10,2h12v2H10V2z M6,2h2v2H6V2z M2,2h2v2H2V2z 
                        M23,29.883   
                        c-3.801-0.009-6.876-3.084-6.885-6.883c0.009-3.801,3.084-6.876,6.885-6.885c3.799,0.009,6.874,
                        3.084,6.883,6.885   
                        C29.874,26.799,26.799,29.874,23,29.883z M29.999,
                        17.348c-0.57-0.706-1.243-1.324-1.999-1.83V14h-4.99c-0.003,0-0.007,0-0.01,0   
                        s-0.007,0-0.01,0H18v1.516c-2.412,1.614-4,4.361-4,7.483c0,1.054,0.19,2.061,0.523,
                        3H2V6h27.999V17.348z M30,4h-4V2h4V4z"/>
                        <path fill="lightgrey" d="M28,
                        24v-2.001h-1.663c-0.063-0.212-0.145-0.413-0.245-0.606l1.187-1.187l-1.416-1.415l-1.165,1.166   
                        c-0.22-0.123-0.452-0.221-0.697-0.294V18h-2v1.662c-0.229,0.068-0.446,0.158-0.652,
                        0.27l-1.141-1.14l-1.415,1.415l1.14,1.14   
                        c-0.112,0.207-0.202,0.424-0.271,0.653H18v2h1.662c0.073,0.246,0.172,0.479,
                        0.295,0.698l-1.165,1.163l1.413,1.416l1.188-1.187   
                        c0.192,0.101,0.394,0.182,0.605,0.245V28H24v-1.665c0.229-0.068,0.445-0.158,
                        0.651-0.27l1.212,1.212l1.414-1.416l-1.212-1.21   
                        c0.111-0.206,0.201-0.423,0.27-0.651H28z M22.999,
                        24.499c-0.829-0.002-1.498-0.671-1.501-1.5c0.003-0.829,0.672-1.498,1.501-1.501   
                        c0.829,0.003,1.498,0.672,1.5,1.501C24.497,23.828,23.828,24.497,22.999,24.499z"/>
                    </g>
                </svg>
            </button>
            <button type="button" id="dc-lock-btn" style="background-color: transparent;"/>
            <button type="button" id="dc-passwd-btn" style="background-color: transparent;" title="Password Settings">
                <svg class="dc-svg" version="1.1" viewBox="0 0 32 32" width="20px" height="20px">
                    <g fill="none" fill-rule="evenodd" stroke="none" stroke-width="1">
                        <g fill="lightgrey">
                            <path d="M13.008518,22 L11.508518,23.5 L11.508518,23.5 L14.008518,26 L11.008518,
                            29 L8.50851798,26.5 L6.63305475,28.3754632 C5.79169774,29.2168202 
                            4.42905085,29.2205817 3.5909158,28.3824466 L3.62607133,28.4176022 C2.78924,27.5807709 
                            2.79106286,26.2174551 3.63305475,25.3754632 L15.7904495,13.2180685
                             C15.2908061,12.2545997 15.008518,11.1602658 15.008518,10 C15.008518,6.13400656 18.1425245,
                             3 22.008518,3 C25.8745114,3 
                             29.008518,6.13400656 29.008518,10 C29.008518,13.8659934 25.8745114,17 22.008518,
                             17 C20.8482521,17 19.7539183,16.7177118 18.7904495,16.2180685 
                             L18.7904495,16.2180685 L16.008518,19 L18.008518,21 L15.008518,24 L13.008518,22 L13.008518,
                             22 L13.008518,22 Z M22.008518,14 C24.2176571,14 
                             26.008518,12.2091391 26.008518,10 C26.008518,7.79086089 24.2176571,6 22.008518,
                             6 C19.7993789,6 18.008518,7.79086089 18.008518,10 C18.008518,12.2091391 
                             19.7993789,14 22.008518,14 L22.008518,14 Z" id="key"/>
                        </g>
                    </g>
                </svg>
            </button>
            <button type="button" id="dc-exchange-btn" style="background-color: transparent;" title="Key Exchange Menu">
                <svg class="dc-svg" version="1.1" viewBox="0 0 78 78" width="20px" height="20px">
                    <path d="M72,4.5H6c-3.299,0-6,2.699-6,6V55.5c0,3.301,2.701,6,6,6h66c3.301,0,6-2.699,6-6V10.5  
                    C78,7.2,75.301,4.5,72,4.5z M72,50.5H6V10.5h66V50.5z 
                    M52.5,67.5h-27c-1.66,0-3,1.341-3,3v3h33v-3C55.5,68.84,54.16,67.5,52.5,67.5z   
                    M26.991,36.5H36v-12h-9.009v-6.729L15.264,30.5l11.728,12.728V36.5z 
                    M50.836,43.228L62.563,30.5L50.836,17.771V24.5h-9.009v12  h9.009V43.228z" style="fill:#d3d3d3;"/>
                </svg>
            </button>
            <button type="button" id="dc-quick-exchange-btn" style="background-color: transparent;" 
            title="Generate & Send New Public Key">
                <svg class="dc-svg iconActive-AKd_jq icon-1R19_H iconMargin-2YXk4F" x="0px" y="0px" viewBox="0 0 58 58">
                    <path style="fill:#d3d3d3;" 
                    d="M27.767,26.73c-2.428-2.291-3.766-5.392-3.766-8.729c0-6.617,5.383-12,12-12s12,5.383,12,12  
                    c0,3.288-1.372,6.469-3.765,8.728l-1.373-1.455c2.023-1.909,
                    3.138-4.492,3.138-7.272c0-5.514-4.486-10-10-10s-10,4.486-10,10  
                    c0,2.781,1.114,5.365,3.139,7.274L27.767,26.73z"/>
                    <path style="fill:#d3d3d3;" d="M56.428,38.815c-0.937-0.695-2.188-0.896-3.435-0.55l-15.29,4.227  
                    C37.891,42.028,38,41.522,38,
                    40.991c0-2.2-1.794-3.991-3.999-3.991h-9.377c-0.667-1-2.363-4-4.623-4H16v-0.999  
                    C16,30.347,14.654,29,13,29H9c-1.654,0-3,1.347-3,3v17C6,50.655,7.346,52,9,52h4c1.654,0,
                    3-1.345,3-2.999v-0.753l12.14,8.201  
                    c1.524,1.031,3.297,1.55,5.075,1.55c1.641,0,3.286-0.441,4.742-1.33l18.172-11.101C57.283,
                    44.864,58,43.587,58,42.233v-0.312  
                    C58,40.688,57.427,39.556,56.428,38.815z M14,49C14,49.553,13.552,
                    50,13,50h-1v-4h-2v4H9c-0.552,0-1-0.447-1-0.999v-17  
                    C8,31.449,8.448,31,9,31h4c0.552,0,1,0.449,1,1V49z M56,42.233c0,0.66-0.35,1.284-0.913,
                    1.628L36.915,54.962  
                    c-2.367,1.443-5.37,1.376-7.655-0.17L16,45.833V35h4c1.06,0,2.469,2.034,3.088,3.409L23.354,39h10.646  
                    C35.104,39,36,39.892,36,40.988C36,42.098,35.104,43,34,43H29h-5v2h5h5h2l17.525-4.807c0.637-0.18,
                    1.278-0.094,1.71,0.228  
                    C55.722,40.781,56,41.328,56,41.922V42.233z"/>
                    <path style="fill:#d3d3d3;" d="M33,25.394v6.607C33,33.655,
                    34.347,35,36,35H38h1h4v-2h-4v-2h2v-2h-2v-3.577  
                    c3.02-1.186,5-4.079,5-7.422c0-2.398-1.063-4.649-2.915-6.177c-1.85-1.524-4.283-2.134-6.683-1.668  
                    c-3.155,0.614-5.671,3.153-6.261,6.318C27.39,20.523,29.933,24.041,33,
                    25.394z M30.108,16.84c0.44-2.364,2.319-4.262,4.677-4.721  
                    c1.802-0.356,3.639,0.104,5.028,1.249S42,
                    16.202,42,18c0,2.702-1.719,5.011-4.276,5.745L37,23.954V33h-0.999  
                    C35.449,33,35,32.553,35,32v-8.02l-0.689-0.225C31.822,22.943,29.509,20.067,30.108,16.84z"/>
                    <path d="M36,22c2.206,0,4-1.794,4-4s-1.794-4-4-4s-4,1.794-4,4S33.795,22,36,22z   
                    M36,16c1.103,0,2,0.897,2,2s-0.897,2-2,2s-2-0.897-2-2S34.898,16,36,16z"/>
                    <circle style="fill:#d3d3d3;" cx="36" cy="18" r="3"/>
                </svg>
            </button>
            `;

        /**
         * @desc Contains the raw HTML injected into the overlay to prompt for the master password for database
         *      unlocking.
         * @type {string}
         */
        this.masterPasswordHtml =
            `
            <div id="dc-master-overlay" class="dc-overlay">
                <div id="dc-overlay-centerfield" class="dc-overlay-centerfield" style="top: 30%">
                    <h2 style="color:#ff0000;" id="dc-header-master-msg"></h2>
                    <br/><br/>
                    
                    <span id="dc-prompt-master-msg"></span><br/>
                    <input type="password" class="dc-password-field" id="dc-db-password"/>
                    <br/>
                    
                    <div class="stat stat-bar">
                        <span id = "dc-master-status" class="stat-bar-rating" style="width: 0;"/>
                    </div>

                    <div class="dc-ruler-align">
                        <button class="dc-button" style="width:100%;" id="dc-unlock-database-btn"/>
                    </div>
                    
                    <div class="dc-ruler-align">
                        <button class="dc-button dc-button-inverse" 
                            style="width:100%;" id="dc-cancel-btn">Cancel</button>
                    </div>
                </div>
            </div>
            `;

        /**
         * @desc Defines the raw HTML used describing each option menu.
         * @type {string}
         */
        this.settingsMenuHtml =
            `
            <div id="dc-overlay" class="dc-overlay">
                <div id="dc-overlay-upload" class="dc-overlay-centerfield" style="display:none; top: 5%;">
                    <div class="dc-ruler-align">
                        <input type="text" class="dc-input-field" id="dc-file-path" 
                            style="width: 100%;padding: 2px;margin-left: 4px;" readonly/>
                        <button class="dc-button dc-button-inverse" type="button" id="dc-select-file-path-btn" 
                            style="top: -8px;"> . . .</button>
                    </div>
                    
                    <textarea class="dc-textarea" rows="20" cols="128" id="dc-file-message-textarea" 
                        placeholder="Enter any addition text to send with your message ..." maxlength="1100"/>
                        
                    <div class="dc-ruler-align" style="font-size:14px; padding-bottom:10px;">
                        <input id="dc-file-deletion-checkbox" class="ui-switch-checkbox" type="checkbox">
                            <span style="margin-top: 5px;">Send Deletion Link</span>
                    </div>
                    <div class="dc-ruler-align" style="font-size:14px; padding-bottom:10px;">
                        <input id="dc-file-name-random-checkbox" class="ui-switch-checkbox" type="checkbox" checked>
                        <span style="margin-top: 5px;">Randomize File Name</span>
                    </div>
                    
                    <div class="stat stat-bar">
                        <span id = "dc-file-upload-status" class="stat-bar-rating" style="width: 0;"/>
                    </div>

                    <div class="dc-ruler-align">
                        <button class="dc-button" style="width:100%;" id="dc-file-upload-btn">Upload</button>
                    </div>
                    
                    <div class="dc-ruler-align">
                        <button class="dc-button dc-button-inverse" style="width:100%;" id="dc-file-cancel-btn">
                        Close</button>
                    </div>
                </div>
                <div id="dc-overlay-password" class="dc-overlay-centerfield" style="display:none;">
                    <span>Primary Password:</span>
                    <input type="password" class="dc-password-field" id="dc-password-primary" placeholder="..."/><br/>
                    
                    <span>Secondary Password:</span>
                    <input type="password" class="dc-password-field" id="dc-password-secondary" placeholder="..."/><br/>
                    
                    <div class="dc-ruler-align">
                        <button class="dc-button" id="dc-save-pwd">Update Passwords</button>
                        <button class="dc-button dc-button-inverse" id="dc-reset-pwd">Reset Passwords</button>
                        <button class="dc-button dc-button-inverse" id="dc-cancel-btn">Cancel</button>
                    </div>
                    
                    <button class="dc-button dc-button-inverse" style="width: 100%;" id="dc-cpy-pwds-btn">
                    Copy Current Passwords</button>
                </div>
                <div id="dc-update-overlay" class="dc-overlay-centerfield" 
                style="top: 5%;border: 1px solid;display: none">
                    <span>DiscordCrypt: Update Available</span>
                    <div class="dc-ruler-align">
                        <strong class="dc-hint dc-update-field" id="dc-new-version"/>
                    </div>
                    <div class="dc-ruler-align">
                        <strong class="dc-hint dc-update-field" id="dc-old-version"/>
                    </div>
                    <div class="dc-ruler-align">
                        <strong class="dc-hint dc-update-field">Changelog:</strong></div>
                    <div class="dc-ruler-align">
                        <textarea class="dc-textarea" rows="20" cols="128" id="dc-changelog" readonly/>
                    </div>
                    <br>
                    <div class="dc-ruler-align">
                        <button class="dc-button" id="dc-restart-now-btn" style="width: 50%;">Restart Now</button>
                        <button class="dc-button dc-button-inverse" id="dc-restart-later-btn" style="width: 50%;">
                        Restart Later</button>
                    </div>
                </div>
                <div id="dc-overlay-settings" class="dc-overlay-main" style="display: none;">
                    <div class="tab" id="dc-settings-tab">
                        <button class='dc-tab-link' id="dc-exit-settings-btn" style="float:right;">[ X ]</button>
                    </div>
                    <div class="tab-content" id="dc-settings" style="display: block;">
                        <p style="text-align: center;">
                            <b>DiscordCrypt Settings</b>
                        </p>
                        <br/><br/>
                        
                        <div class="dc-ruler-align">
                            <div class="dc-input-label">Primary Cipher:</div>
                            <select class="dc-input-field" id="dc-primary-cipher">
                                <option value="bf" selected>Blowfish ( 512-Bit )</option>
                                <option value="aes">AES ( 256-Bit )</option>
                                <option value="camel">Camellia ( 256-Bit )</option>
                                <option value="tdes">TripleDES ( 192-Bit )</option>
                                <option value="idea">IDEA ( 128-Bit )</option>
                            </select>
                        </div>
                        
                        <div class="dc-ruler-align">
                            <div class="dc-input-label">Secondary Cipher:</div>
                            <select class="dc-input-field" id="dc-secondary-cipher">
                                <option value="bf">Blowfish ( 512-Bit )</option>
                                <option value="aes">AES ( 256-Bit )</option>
                                <option value="camel">Camellia ( 256-Bit )</option>
                                <option value="idea">IDEA ( 256-Bit )</option>
                                <option value="tdes">TripleDES ( 192-Bit )</option>
                            </select>
                        </div>
                        
                        <div class="dc-ruler-align">
                            <div class="dc-input-label">Padding Mode:</div>
                            <select class="dc-input-field" id="dc-settings-padding-mode">
                                <option value="pkc7">PKCS #7</option>
                                <option value="ans2">ANSI X9.23</option>
                                <option value="iso1">ISO 10126</option>
                                <option value="iso9">ISO 97971</option>
                            </select>
                        </div>
                        
                        <div class="dc-ruler-align">
                            <div class="dc-input-label">Cipher Operation Mode:</div>
                            <select class="dc-input-field" id="dc-settings-cipher-mode">
                                <option value="cbc">Cipher Block Chaining</option>
                                <option value="cfb">Cipher Feedback Mode</option>
                                <option value="ofb">Output Feedback Mode</option>
                            </select>
                        </div>
                        
                        <div class="dc-ruler-align">
                            <div class="dc-input-label">Default Encryption Password:</div>
                            <input type="text" class="dc-input-field" id="dc-settings-default-pwd"/>
                        </div>
                        
                        <div class="dc-ruler-align">
                            <div class="dc-input-label">Encryption Scanning Frequency:</div>
                            <input type="text" class="dc-input-field" id="dc-settings-scan-delay"/>
                        </div>
                        
                        <div class="dc-ruler-align">
                            <div class="dc-input-label">Message Trigger:</div>
                            <input type="text" class="dc-input-field" id="dc-settings-encrypt-trigger"/>
                        </div>
                        
                        <div style="font-size: 9px;">
                            <div style="display: flex;">
                                <div style="width: 30%;"></div>
                                <p class="dc-hint">
                                The suffix at the end of a typed message to indicate whether to encrypt the text.</p>
                            </div>
                            <div style="display: flex;">
                                <div style="width: 30%;"></div>
                                <p class="dc-hint">Example: <u>This message will be encrypted.|ENC</u></p>
                            </div>
                        </div>
                        
                        <div class="dc-ruler-align">
                            <div class="dc-input-label">New Master Database Password:</div>
                            <input type="text" class="dc-input-field" id="dc-master-password"/>
                        </div>
                        
                        <div class="dc-ruler-align">
                            <button id="dc-settings-save-btn" class="dc-button">Save & Apply</button>
                            <button id="dc-settings-reset-btn" class="dc-button dc-button-inverse">
                            Reset Settings</button>
                        </div>
                    </div>
                </div>
                <div id="dc-overlay-exchange" class="dc-overlay-main" style="display: none;">
                    <div class="tab" id="dc-exchange-tab">
                        <button class='dc-tab-link' id="dc-tab-info-btn">Info</button>
                        <button class='dc-tab-link' id="dc-tab-keygen-btn">Key Generation</button>
                        <button class='dc-tab-link' id="dc-tab-handshake-btn">Secret Computation</button>
                        <button class='dc-tab-link' id="dc-exit-exchange-btn" style="float:right;">[ X ]</button>
                    </div>
                    <div class="tab-content" id="dc-about-tab" style="display: block;">
                        <p style="text-align: center;">
                            <b>Key Exchanger</b>
                        </p>
                        <br/>
                        
                        <strong>What is this used for?</strong>
                        <ul class="dc-list">
                            <li>Simplifying the process or generating strong passwords for each user of DiscordCrypt 
                            requires a secure channel to exchange these keys.</li>
                            <li>Using this generator, you may create new keys using standard algorithms such as 
                            DH or ECDH for manual handshaking.</li>
                            <li>Follow the steps below and you can generate a password between channels or users 
                            while being able to publicly post the messages.</li>
                            <li>This generator uses secure hash algorithms ( SHA-256 and SHA-512 ) in tandem with 
                            the Scrypt KDF function to derive two keys.</li>
                        </ul>
                        <br/>
                        
                        <strong>How do I use this?</strong>
                        <ul class="dc-list">
                            <li>Generate a key pair using the specified algorithm and key size on the 
                            "Key Generation" tab.</li>
                            <li>Give your partner your public key by clicking the "Send Public Key" button.</li>
                            <li>Ask your partner to give you their public key using the same step above.</li>
                            <li>Copy your partner's public key and paste it in the "Secret Computation" tab and 
                            select "Compute Secret Keys".</li>
                            <li>Wait for <span style="text-decoration: underline;color: #ff0000;">BOTH</span> 
                            the primary and secondary keys to be generated.</li>
                            <li>A status bar is provided to easily tell you when both passwords 
                            have been generated.</li>
                            <li>Click the "Apply Generated Passwords" button to apply both passwords to 
                            the current user or channel.</li>
                        </ul>
                        
                        <strong>Algorithms Supported:</strong>
                        <ul class="dc-list">
                            <li>
                                <a title="Diffie–Hellman key exchange" 
                                href="https://en.wikipedia.org/wiki/Diffie%E2%80%93Hellman_key_exchange"
                                 target="_blank" rel="noopener">Diffie-Hellman ( DH )</a>
                            </li>
                            <li>
                                <a title="Elliptic curve Diffie–Hellman" 
                                href="https://en.wikipedia.org/wiki/Elliptic_curve_Diffie%E2%80%93Hellman"
                                 target="_blank" rel="noopener">Elliptic Curve Diffie-Hellman ( ECDH )</a>
                            </li>
                        </ul>
                        
                        <span style="text-decoration: underline; color: #ff0000;">
                            <strong>DO NOT:</strong>
                        </span>
                        <ul class="dc-list dc-list-red">
                            <li>
                                <strong>Post your private key. If you do, generate a new one IMMEDIATELY.</strong>
                            </li>
                            <li>
                                <strong>Alter your public key or have your partner alter theirs in any way.</strong>
                            </li>
                            <li>
                                <strong>Insert a random public key.</strong>
                            </li>
                        </ul>
                    </div>
                    <div class="tab-content" id="dc-keygen-tab" style="display: block;">
                        <p style="text-align: center;">
                            <b style="font-size: large;">Secure Key Generation</b>
                        </p>
                        <br/>
                        
                        <strong>Exchange Algorithm:</strong>
                        <select id="dc-keygen-method">
                            <option value="dh" selected>Diffie-Hellman</option>
                            <option value="ecdh">Elliptic-Curve Diffie-Hellman</option>
                        </select>
                        <br/><br/>
                
                        <strong>Key Length ( Bits ):</strong>
                        <select id="dc-keygen-algorithm">
                            <option value="768">768</option>
                            <option value="1024">1024</option>
                            <option value="1536">1536</option>
                            <option value="2048">2048</option>
                            <option value="3072">3072</option>
                            <option value="4096">4096</option>
                            <option value="6144">6144</option>
                            <option value="8192" selected>8192</option>
                        </select>
                        <br/><br/>
                
                        <div class="dc-ruler-align">
                            <button id="dc-keygen-gen-btn" class="dc-button">Generate</button>
                            <button id="dc-keygen-clear-btn" class="dc-button dc-button-inverse">Clear</button>
                        </div>
                        <br/><br/><br/>
                
                        <strong>Private Key: ( 
                        <span style="text-decoration: underline; color: #ff0000;">KEEP SECRET</span>
                         )</strong><br/>
                        <textarea id="dc-priv-key-ta" rows="8" cols="128" maxsize="8192"
                         unselectable="on" disabled readonly/>
                        <br/><br/>
                
                        <strong>Public Key:</strong><br/>
                        <textarea id="dc-pub-key-ta" rows="8" cols="128" maxsize="8192" 
                        unselectable="on" disabled readonly/>
                        <br/><br/>
                
                        <div class="dc-ruler-align">
                            <button id="dc-keygen-send-pub-btn" class="dc-button">Send Public Key</button>
                        </div>
                        <br/>
                        
                        <ul class="dc-list dc-list-red">
                            <li>Never rely on copying these keys. Use the "Send Public Key" button 
                            to send your key.</li>
                            <li>Public keys are automatically encoded with a random salts.</li>
                            <li>Posting these keys directly won't work since they aren't encoded 
                            in the format required.</li>
                        </ul>
                    </div>
                    <div class="tab-content" id="dc-handshake-tab">
                        <p style="text-align: center;">
                            <b style="font-size: large;">Key Derivation</b>
                        </p>
                        <br/>
                        
                        <p>
                            <span style="text-decoration: underline; color: #ff0000;">
                                <strong>NOTE:</strong>
                            </span>
                        </p>
                        <ul class="dc-list dc-list-red">
                            <li>Copy your partner's private key EXACTLY as it was posted.</li>
                            <li>Your last generated private key from the "Key Generation" tab 
                            will be used to compute these keys.</li>
                        </ul>
                        <br/>
                        
                        <strong>Partner's Public Key:</strong><br/>
                        <textarea id="dc-handshake-ppk" rows="8" cols="128" maxsize="16384"/>
                        <br/><br/>
                        
                        <div class="dc-ruler-align">
                            <button id="dc-handshake-paste-btn" class="dc-button dc-button-inverse">
                            Paste From Clipboard</button>
                            <button id="dc-handshake-compute-btn" class="dc-button">Compute Secret Keys</button>
                        </div>
                        
                        <ul class="dc-list dc-list-red">
                            <li id="dc-handshake-algorithm">...</li>
                            <li id="dc-handshake-salts">...</li>
                            <li id="dc-handshake-secret">...</li>
                        </ul>
                        <br/>
                        
                        <strong id="dc-handshake-prim-lbl">Primary Secret:</strong><br/>
                        <textarea id="dc-handshake-primary-key" rows="1" columns="128" maxsize="32768"
                         style="max-height: 14px;user-select: none;" unselectable="on" disabled/>
                        <br/><br/>
                        
                        <strong id="dc-handshake-sec-lbl">Secondary Secret:</strong><br/>
                        <textarea id="dc-handshake-secondary-key" rows="1" columns="128" maxsize="32768"
                         style="max-height: 14px;user-select: none;" unselectable="on" disabled/>
                        <br/><br/>
                        
                        <div class="stat stat-bar" style="width:70%;">
                            <span id="dc-exchange-status" class="stat-bar-rating" style="width: 0;"/>
                        </div><br/>
                        
                        <div class="dc-ruler-align">
                            <button id="dc-handshake-cpy-keys-btn" class="dc-button dc-button-inverse">
                            Copy Keys & Nuke</button>
                            <button id="dc-handshake-apply-keys-btn" class="dc-button">
                            Apply Generated Passwords</button>
                        </div>
                    </div>
                </div>
            </div>
            `;

        /**
         * @desc The Base64 encoded SVG containing the unlocked status icon.
         * @type {string}
         */
        this.unlockIcon = "PHN2ZyBjbGFzcz0iZGMtc3ZnIiBmaWxsPSJsaWdodGdyZXkiIGhlaWdodD0iMjBweCIgdmlld0JveD0iMCAwIDI0I" +
            "DI0IiB3aWR0aD0iMjBweCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMTdjMS4xIDAgMi0u" +
            "OSAyLTJzLS45LTItMi0yLTIgLjktMiAyIC45IDIgMiAyem02LTloLTFWNmMwLTIuNzYtMi4yNC01LTUtNVM3IDMuMjQgNyA2aDEuOWM" +
            "wLTEuNzEgMS4zOS0zLjEgMy4xLTMuMSAxLjcxIDAgMy4xIDEuMzkgMy4xIDMuMXYySDZjLTEuMSAwLTIgLjktMiAydjEwYzAgMS4xLj" +
            "kgMiAyIDJoMTJjMS4xIDAgMi0uOSAyLTJWMTBjMC0xLjEtLjktMi0yLTJ6bTAgMTJINlYxMGgxMnYxMHoiPjwvcGF0aD48L3N2Zz4=";

        /**
         * @desc The Base64 encoded SVG containing the locked status icon.
         * @type {string}
         */
        this.lockIcon = "PHN2ZyBjbGFzcz0iZGMtc3ZnIiBmaWxsPSJsaWdodGdyZXkiIGhlaWdodD0iMjBweCIgdmlld0JveD0iMCAwIDI0IDI" +
            "0IiB3aWR0aD0iMjBweCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0aCBkPSJNMCAwaDI0djI0SD" +
            "BWMHoiIGlkPSJhIi8+PC9kZWZzPjxjbGlwUGF0aCBpZD0iYiI+PHVzZSBvdmVyZmxvdz0idmlzaWJsZSIgeGxpbms6aHJlZj0iI2EiL" +
            "z48L2NsaXBQYXRoPjxwYXRoIGNsaXAtcGF0aD0idXJsKCNiKSIgZD0iTTEyIDE3YzEuMSAwIDItLjkgMi0ycy0uOS0yLTItMi0yIC45" +
            "LTIgMiAuOSAyIDIgMnptNi05aC0xVjZjMC0yLjc2LTIuMjQtNS01LTVTNyAzLjI0IDcgNnYySDZjLTEuMSAwLTIgLjktMiAydjEwYzA" +
            "gMS4xLjkgMiAyIDJoMTJjMS4xIDAgMi0uOSAyLTJWMTBjMC0xLjEtLjktMi0yLTJ6TTguOSA2YzAtMS43MSAxLjM5LTMuMSAzLjEtMy" +
            "4xczMuMSAxLjM5IDMuMSAzLjF2Mkg4LjlWNnpNMTggMjBINlYxMGgxMnYxMHoiLz48L3N2Zz4=";

        /**
         * @desc These contain all libraries that will be loaded dynamically in the current JS VM.
         * @type {{string, string}}
         */
        this.libraries = {
                        'currify.js': "!function(n){if(\"object\"==typeof exports&&\"undefined\"!=typeof module)module.exports=n();else if(\"function\"==typeof define&&define.amd)define([],n);else{var r;(r=\"undefined\"!=typeof window?window:\"undefined\"!=typeof global?global:\"undefined\"!=typeof self?self:this).currify=n()}}(function(){var n,r,e;return function n(r,e,t){function o(f,u){if(!e[f]){if(!r[f]){var c=\"function\"==typeof require&&require;if(!u&&c)return c(f,!0);if(i)return i(f,!0);var p=new Error(\"Cannot find module '\"+f+\"'\");throw p.code=\"MODULE_NOT_FOUND\",p}var l=e[f]={exports:{}};r[f][0].call(l.exports,function(n){var e=r[f][1][n];return o(e||n)},l,l.exports,n,r,e,t)}return e[f].exports}for(var i=\"function\"==typeof require&&require,f=0;f<t.length;f++)o(t[f]);return o}({currify:[function(n,r,e){\"use strict\";var t=function n(r){return[function(n){return r.apply(void 0,arguments)},function(n,e){return r.apply(void 0,arguments)},function(n,e,t){return r.apply(void 0,arguments)},function(n,e,t,o){return r.apply(void 0,arguments)},function(n,e,t,o,i){return r.apply(void 0,arguments)}]};function o(n){if(\"function\"!=typeof n)throw Error(\"fn should be function!\")}r.exports=function n(r){for(var e=arguments.length,i=Array(e>1?e-1:0),f=1;f<e;f++)i[f-1]=arguments[f];if(o(r),i.length>=r.length)return r.apply(void 0,i);var u=function e(){return n.apply(void 0,[r].concat(i,Array.prototype.slice.call(arguments)))},c=r.length-i.length-1,p;return t(u)[c]||u}},{}]},{},[\"currify\"])(\"currify\")});\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIjAiXSwibmFtZXMiOlsiZiIsImV4cG9ydHMiLCJtb2R1bGUiLCJkZWZpbmUiLCJhbWQiLCJnIiwid2luZG93IiwiZ2xvYmFsIiwic2VsZiIsInRoaXMiLCJjdXJyaWZ5IiwiZSIsInQiLCJuIiwiciIsInMiLCJvIiwidSIsImEiLCJyZXF1aXJlIiwiaSIsIkVycm9yIiwiY29kZSIsImwiLCJjYWxsIiwibGVuZ3RoIiwiZm4iLCJhcHBseSIsInVuZGVmaW5lZCIsImFyZ3VtZW50cyIsImIiLCJjIiwiZCIsImNoZWNrIiwiX2xlbiIsImFyZ3MiLCJBcnJheSIsIl9rZXkiLCJhZ2FpbiIsImNvbmNhdCIsInByb3RvdHlwZSIsInNsaWNlIiwiY291bnQiLCJmdW5jIl0sIm1hcHBpbmdzIjoiQ0FBQSxTQUFVQSxHQUFHLEdBQW9CLGlCQUFWQyxTQUFvQyxvQkFBVEMsT0FBc0JBLE9BQU9ELFFBQVFELFNBQVMsR0FBbUIsbUJBQVRHLFFBQXFCQSxPQUFPQyxJQUFLRCxVQUFVSCxPQUFPLENBQUMsSUFBSUssR0FBa0NBLEVBQWIsb0JBQVRDLE9BQXdCQSxPQUErQixvQkFBVEMsT0FBd0JBLE9BQTZCLG9CQUFQQyxLQUFzQkEsS0FBWUMsTUFBT0MsUUFBVVYsS0FBNVQsQ0FBbVUsV0FBVyxJQUFJRyxFQUFPRCxFQUFPRCxFQUFRLE9BQU8sU0FBVVUsRUFBRUMsRUFBRUMsRUFBRUMsR0FBRyxTQUFTQyxFQUFFQyxFQUFFQyxHQUFHLElBQUlKLEVBQUVHLEdBQUcsQ0FBQyxJQUFJSixFQUFFSSxHQUFHLENBQUMsSUFBSUUsRUFBa0IsbUJBQVRDLFNBQXFCQSxRQUFRLElBQUlGLEdBQUdDLEVBQUUsT0FBT0EsRUFBRUYsR0FBRSxHQUFJLEdBQUdJLEVBQUUsT0FBT0EsRUFBRUosR0FBRSxHQUFJLElBQUloQixFQUFFLElBQUlxQixNQUFNLHVCQUF1QkwsRUFBRSxLQUFLLE1BQU1oQixFQUFFc0IsS0FBSyxtQkFBbUJ0QixFQUFFLElBQUl1QixFQUFFVixFQUFFRyxJQUFJZixZQUFZVyxFQUFFSSxHQUFHLEdBQUdRLEtBQUtELEVBQUV0QixRQUFRLFNBQVNVLEdBQUcsSUFBSUUsRUFBRUQsRUFBRUksR0FBRyxHQUFHTCxHQUFHLE9BQU9JLEVBQUVGLEdBQUlGLElBQUlZLEVBQUVBLEVBQUV0QixRQUFRVSxFQUFFQyxFQUFFQyxFQUFFQyxHQUFHLE9BQU9ELEVBQUVHLEdBQUdmLFFBQWtELElBQTFDLElBQUltQixFQUFrQixtQkFBVEQsU0FBcUJBLFFBQWdCSCxFQUFFLEVBQUVBLEVBQUVGLEVBQUVXLE9BQU9ULElBQUlELEVBQUVELEVBQUVFLElBQUksT0FBT0QsRUFBdmIsRUFBNGJMLFNBQVcsU0FBU1MsRUFBUWpCLEVBQU9ELEdBQ3QwQixhQUVBLElBQUlELEVBQUksU0FBU0EsRUFBRTBCLEdBQ2YsT0FFSSxTQUFVUixHQUNOLE9BQU9RLEVBQUdDLFdBQU1DLEVBQVdDLFlBQzVCLFNBQVVYLEVBQUdZLEdBQ1osT0FBT0osRUFBR0MsV0FBTUMsRUFBV0MsWUFDNUIsU0FBVVgsRUFBR1ksRUFBR0MsR0FDZixPQUFPTCxFQUFHQyxXQUFNQyxFQUFXQyxZQUM1QixTQUFVWCxFQUFHWSxFQUFHQyxFQUFHQyxHQUNsQixPQUFPTixFQUFHQyxXQUFNQyxFQUFXQyxZQUM1QixTQUFVWCxFQUFHWSxFQUFHQyxFQUFHQyxFQUFHckIsR0FDckIsT0FBT2UsRUFBR0MsV0FBTUMsRUFBV0MsY0F1QnZDLFNBQVNJLEVBQU1QLEdBQ1gsR0FBa0IsbUJBQVBBLEVBQW1CLE1BQU1MLE1BQU0sMEJBcEI5Q25CLEVBQU9ELFFBQVUsU0FBU1MsRUFBUWdCLEdBQzlCLElBQUssSUFBSVEsRUFBT0wsVUFBVUosT0FBUVUsRUFBT0MsTUFBTUYsRUFBTyxFQUFJQSxFQUFPLEVBQUksR0FBSUcsRUFBTyxFQUFHQSxFQUFPSCxFQUFNRyxJQUM1RkYsRUFBS0UsRUFBTyxHQUFLUixVQUFVUSxHQUsvQixHQUZBSixFQUFNUCxHQUVGUyxFQUFLVixRQUFVQyxFQUFHRCxPQUFRLE9BQU9DLEVBQUdDLFdBQU1DLEVBQVdPLEdBRXpELElBQUlHLEVBQVEsU0FBU0EsSUFDakIsT0FBTzVCLEVBQVFpQixXQUFNQyxHQUFZRixHQUFJYSxPQUFPSixFQUFNQyxNQUFNSSxVQUFVQyxNQUFNakIsS0FBS0ssY0FHN0VhLEVBQVFoQixFQUFHRCxPQUFTVSxFQUFLVixPQUFTLEVBQ2xDa0IsRUFFSixPQUZXM0MsRUFBRXNDLEdBQU9JLElBRUxKLGFBTVosV0F6Q2dXLENBeUNwViJ9",
            'sjcl.js': "\"use strict\";function r(t){throw t}var s=void 0,v=!1;function H(){return function(){}}var sjcl={cipher:{},hash:{},keyexchange:{},mode:{},misc:{},codec:{},exception:{corrupt:function(t){this.toString=function(){return\"CORRUPT: \"+this.message},this.message=t},invalid:function(t){this.toString=function(){return\"INVALID: \"+this.message},this.message=t},bug:function(t){this.toString=function(){return\"BUG: \"+this.message},this.message=t},notReady:function(t){this.toString=function(){return\"NOT READY: \"+this.message},this.message=t}}},a;function aa(t,e,n){4!==e.length&&r(new sjcl.exception.invalid(\"invalid aes block size\"));var i=t.b[n],s=e[0]^i[0],c=e[n?3:1]^i[1],o=e[2]^i[2];e=e[n?1:3]^i[3];var a,h,l,u=i.length/4-2,f,d=4,p=[0,0,0,0];t=(a=t.l[n])[0];var y=a[1],g=a[2],m=a[3],b=a[4];for(f=0;f<u;f++)a=t[s>>>24]^y[c>>16&255]^g[o>>8&255]^m[255&e]^i[d],h=t[c>>>24]^y[o>>16&255]^g[e>>8&255]^m[255&s]^i[d+1],l=t[o>>>24]^y[e>>16&255]^g[s>>8&255]^m[255&c]^i[d+2],e=t[e>>>24]^y[s>>16&255]^g[c>>8&255]^m[255&o]^i[d+3],d+=4,s=a,c=h,o=l;for(f=0;4>f;f++)p[n?3&-f:f]=b[s>>>24]<<24^b[c>>16&255]<<16^b[o>>8&255]<<8^b[255&e]^i[d++],a=s,s=c,c=o,o=e,e=a;return p}function da(t,e){var r,n=sjcl.random.A[t],i=[];for(r in n)n.hasOwnProperty(r)&&i.push(n[r]);for(r=0;r<i.length;r++)i[r](e)}function Q(t){\"undefined\"!=typeof window&&window.performance&&\"function\"==typeof window.performance.now?sjcl.random.addEntropy(window.performance.now(),t,\"loadtime\"):sjcl.random.addEntropy((new Date).valueOf(),t,\"loadtime\")}function ba(t){t.b=ca(t).concat(ca(t)),t.B=new sjcl.cipher.aes(t.b)}function ca(t){for(var e=0;4>e&&(t.h[e]=t.h[e]+1|0,!t.h[e]);e++);return t.B.encrypt(t.h)}function P(t,e){return function(){e.apply(t,arguments)}}\"undefined\"!=typeof module&&module.exports&&(module.exports=sjcl),\"function\"==typeof define&&define([],function(){return sjcl}),sjcl.cipher.aes=function(t){this.l[0][0][0]||this.q();var e,n,i,s,c=this.l[0][4],o=this.l[1],a=1;for(4!==(e=t.length)&&6!==e&&8!==e&&r(new sjcl.exception.invalid(\"invalid aes key size\")),this.b=[i=t.slice(0),s=[]],t=e;t<4*e+28;t++)n=i[t-1],(0==t%e||8===e&&4==t%e)&&(n=c[n>>>24]<<24^c[n>>16&255]<<16^c[n>>8&255]<<8^c[255&n],0==t%e&&(n=n<<8^n>>>24^a<<24,a=a<<1^283*(a>>7))),i[t]=i[t-e]^n;for(e=0;t;e++,t--)n=i[3&e?t:t-4],s[e]=4>=t||4>e?n:o[0][c[n>>>24]]^o[1][c[n>>16&255]]^o[2][c[n>>8&255]]^o[3][c[255&n]]},sjcl.cipher.aes.prototype={encrypt:function(t){return aa(this,t,0)},decrypt:function(t){return aa(this,t,1)},l:[[[],[],[],[],[]],[[],[],[],[],[]]],q:function(){var t=this.l[0],e=this.l[1],r=t[4],n=e[4],i,s,c,o=[],a=[],h,l,u,f;for(i=0;256>i;i++)a[(o[i]=i<<1^283*(i>>7))^i]=i;for(s=c=0;!r[s];s^=h||1,c=a[c]||1)for(u=(u=c^c<<1^c<<2^c<<3^c<<4)>>8^255&u^99,r[s]=u,n[u]=s,f=16843009*(l=o[i=o[h=o[s]]])^65537*i^257*h^16843008*s,l=257*o[u]^16843008*u,i=0;4>i;i++)t[i][s]=l=l<<24^l>>>8,e[i][u]=f=f<<24^f>>>8;for(i=0;5>i;i++)t[i]=t[i].slice(0),e[i]=e[i].slice(0)}},sjcl.bitArray={bitSlice:function(t,e,r){return t=sjcl.bitArray.M(t.slice(e/32),32-(31&e)).slice(1),r===s?t:sjcl.bitArray.clamp(t,r-e)},extract:function(t,e,r){var n=Math.floor(-e-r&31);return(-32&(e+r-1^e)?t[e/32|0]<<32-n^t[e/32+1|0]>>>n:t[e/32|0]>>>n)&(1<<r)-1},concat:function(t,e){if(0===t.length||0===e.length)return t.concat(e);var r=t[t.length-1],n=sjcl.bitArray.getPartial(r);return 32===n?t.concat(e):sjcl.bitArray.M(e,n,0|r,t.slice(0,t.length-1))},bitLength:function(t){var e=t.length;return 0===e?0:32*(e-1)+sjcl.bitArray.getPartial(t[e-1])},clamp:function(t,e){if(32*t.length<e)return t;var r=(t=t.slice(0,Math.ceil(e/32))).length;return e&=31,0<r&&e&&(t[r-1]=sjcl.bitArray.partial(e,t[r-1]&2147483648>>e-1,1)),t},partial:function(t,e,r){return 32===t?e:(r?0|e:e<<32-t)+1099511627776*t},getPartial:function(t){return Math.round(t/1099511627776)||32},equal:function(t,e){if(sjcl.bitArray.bitLength(t)!==sjcl.bitArray.bitLength(e))return v;var r=0,n;for(n=0;n<t.length;n++)r|=t[n]^e[n];return 0===r},M:function(t,e,r,n){var i;for(i=0,n===s&&(n=[]);32<=e;e-=32)n.push(r),r=0;if(0===e)return n.concat(t);for(i=0;i<t.length;i++)n.push(r|t[i]>>>e),r=t[i]<<32-e;return i=t.length?t[t.length-1]:0,t=sjcl.bitArray.getPartial(i),n.push(sjcl.bitArray.partial(e+t&31,32<e+t?r:n.pop(),1)),n},u:function(t,e){return[t[0]^e[0],t[1]^e[1],t[2]^e[2],t[3]^e[3]]},byteswapM:function(t){var e,r;for(e=0;e<t.length;++e)r=t[e],t[e]=r>>>24|r>>>8&65280|(65280&r)<<8|r<<24;return t}},sjcl.codec.utf8String={fromBits:function(t){var e=\"\",r=sjcl.bitArray.bitLength(t),n,i;for(n=0;n<r/8;n++)0==(3&n)&&(i=t[n/4]),e+=String.fromCharCode(i>>>24),i<<=8;return decodeURIComponent(escape(e))},toBits:function(t){t=unescape(encodeURIComponent(t));var e=[],r,n=0;for(r=0;r<t.length;r++)n=n<<8|t.charCodeAt(r),3==(3&r)&&(e.push(n),n=0);return 3&r&&e.push(sjcl.bitArray.partial(8*(3&r),n)),e}},sjcl.codec.base64={I:\"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/\",fromBits:function(t,e,r){var n=\"\",i=0,s=sjcl.codec.base64.I,c=0,o=sjcl.bitArray.bitLength(t);for(r&&(s=s.substr(0,62)+\"-_\"),r=0;6*n.length<o;)n+=s.charAt((c^t[r]>>>i)>>>26),6>i?(c=t[r]<<6-i,i+=26,r++):(c<<=6,i-=6);for(;3&n.length&&!e;)n+=\"=\";return n},toBits:function(t,e){t=t.replace(/\\s|=/g,\"\");var n=[],i,s=0,c=sjcl.codec.base64.I,o=0,a;for(e&&(c=c.substr(0,62)+\"-_\"),i=0;i<t.length;i++)0>(a=c.indexOf(t.charAt(i)))&&r(new sjcl.exception.invalid(\"this isn't base64!\")),26<s?(s-=26,n.push(o^a>>>s),o=a<<32-s):o^=a<<32-(s+=6);return 56&s&&n.push(sjcl.bitArray.partial(56&s,o,1)),n}},sjcl.codec.base64url={fromBits:function(t){return sjcl.codec.base64.fromBits(t,1,1)},toBits:function(t){return sjcl.codec.base64.toBits(t,1)}},sjcl.codec.bytes={fromBits:function(t){var e=[],r=sjcl.bitArray.bitLength(t),n,i;for(n=0;n<r/8;n++)0==(3&n)&&(i=t[n/4]),e.push(i>>>24),i<<=8;return e},toBits:function(t){var e=[],r,n=0;for(r=0;r<t.length;r++)n=n<<8|t[r],3==(3&r)&&(e.push(n),n=0);return 3&r&&e.push(sjcl.bitArray.partial(8*(3&r),n)),e}},sjcl.hash.sha256=function(t){this.b[0]||this.q(),t?(this.e=t.e.slice(0),this.d=t.d.slice(0),this.c=t.c):this.reset()},sjcl.hash.sha256.hash=function(t){return(new sjcl.hash.sha256).update(t).finalize()},sjcl.hash.sha256.prototype={blockSize:512,reset:function(){return this.e=this.i.slice(0),this.d=[],this.c=0,this},update:function(t){\"string\"==typeof t&&(t=sjcl.codec.utf8String.toBits(t));var e,r=this.d=sjcl.bitArray.concat(this.d,t);for(e=this.c,t=this.c=e+sjcl.bitArray.bitLength(t),e=512+e&-512;e<=t;e+=512)this.n(r.splice(0,16));return this},finalize:function(){var t,e=this.d,r=this.e,e;for(t=(e=sjcl.bitArray.concat(e,[sjcl.bitArray.partial(1,1)])).length+2;15&t;t++)e.push(0);for(e.push(Math.floor(this.c/4294967296)),e.push(0|this.c);e.length;)this.n(e.splice(0,16));return this.reset(),r},i:[],b:[],q:function(){function t(t){return 4294967296*(t-Math.floor(t))|0}var e=0,r=2,n;t:for(;64>e;r++){for(n=2;n*n<=r;n++)if(0==r%n)continue t;8>e&&(this.i[e]=t(Math.pow(r,.5))),this.b[e]=t(Math.pow(r,1/3)),e++}},n:function(t){var e,r,n=t.slice(0),i=this.e,s=this.b,c=i[0],o=i[1],a=i[2],h=i[3],l=i[4],u=i[5],f=i[6],d=i[7];for(t=0;64>t;t++)16>t?e=n[t]:(e=n[t+1&15],r=n[t+14&15],e=n[15&t]=(e>>>7^e>>>18^e>>>3^e<<25^e<<14)+(r>>>17^r>>>19^r>>>10^r<<15^r<<13)+n[15&t]+n[t+9&15]|0),e=e+d+(l>>>6^l>>>11^l>>>25^l<<26^l<<21^l<<7)+(f^l&(u^f))+s[t],d=f,f=u,u=l,l=h+e|0,h=a,a=o,c=e+((o=c)&a^h&(o^a))+(o>>>2^o>>>13^o>>>22^o<<30^o<<19^o<<10)|0;i[0]=i[0]+c|0,i[1]=i[1]+o|0,i[2]=i[2]+a|0,i[3]=i[3]+h|0,i[4]=i[4]+l|0,i[5]=i[5]+u|0,i[6]=i[6]+f|0,i[7]=i[7]+d|0}},sjcl.hash.sha512=function(t){this.b[0]||this.q(),t?(this.e=t.e.slice(0),this.d=t.d.slice(0),this.c=t.c):this.reset()},sjcl.hash.sha512.hash=function(t){return(new sjcl.hash.sha512).update(t).finalize()},sjcl.hash.sha512.prototype={blockSize:1024,reset:function(){return this.e=this.i.slice(0),this.d=[],this.c=0,this},update:function(t){\"string\"==typeof t&&(t=sjcl.codec.utf8String.toBits(t));var e,r=this.d=sjcl.bitArray.concat(this.d,t);for(e=this.c,t=this.c=e+sjcl.bitArray.bitLength(t),e=1024+e&-1024;e<=t;e+=1024)this.n(r.splice(0,32));return this},finalize:function(){var t,e=this.d,r=this.e,e;for(t=(e=sjcl.bitArray.concat(e,[sjcl.bitArray.partial(1,1)])).length+4;31&t;t++)e.push(0);for(e.push(0),e.push(0),e.push(Math.floor(this.c/4294967296)),e.push(0|this.c);e.length;)this.n(e.splice(0,32));return this.reset(),r},i:[],T:[12372232,13281083,9762859,1914609,15106769,4090911,4308331,8266105],b:[],V:[2666018,15689165,5061423,9034684,4764984,380953,1658779,7176472,197186,7368638,14987916,16757986,8096111,1480369,13046325,6891156,15813330,5187043,9229749,11312229,2818677,10937475,4324308,1135541,6741931,11809296,16458047,15666916,11046850,698149,229999,945776,13774844,2541862,12856045,9810911,11494366,7844520,15576806,8533307,15795044,4337665,16291729,5553712,15684120,6662416,7413802,12308920,13816008,4303699,9366425,10176680,13195875,4295371,6546291,11712675,15708924,1519456,15772530,6568428,6495784,8568297,13007125,7492395,2515356,12632583,14740254,7262584,1535930,13146278,16321966,1853211,294276,13051027,13221564,1051980,4080310,6651434,14088940,4675607],q:function(){function t(t){return 4294967296*(t-Math.floor(t))|0}function e(t){return 1099511627776*(t-Math.floor(t))&255}var r=0,n=2,i;t:for(;80>r;n++){for(i=2;i*i<=n;i++)if(0==n%i)continue t;8>r&&(this.i[2*r]=t(Math.pow(n,.5)),this.i[2*r+1]=e(Math.pow(n,.5))<<24|this.T[r]),this.b[2*r]=t(Math.pow(n,1/3)),this.b[2*r+1]=e(Math.pow(n,1/3))<<24|this.V[r],r++}},n:function(t){var e,r,n=t.slice(0),i=this.e,s=this.b,c=i[0],o=i[1],a=i[2],h=i[3],l=i[4],u=i[5],f=i[6],d=i[7],p=i[8],y=i[9],g=i[10],m=i[11],b=i[12],v=i[13],j=i[14],w=i[15],A=c,L=o,B=a,C=h,E=l,U=u,k=f,x=d,V=p,M=y,S=g,D=m,P=b,R=v,O=j,z=w;for(t=0;80>t;t++){if(16>t)e=n[2*t],r=n[2*t+1];else{var I;r=n[2*(t-15)],e=((I=n[2*(t-15)+1])<<31|r>>>1)^(I<<24|r>>>8)^r>>>7;var T=(r<<31|I>>>1)^(r<<24|I>>>8)^(r<<25|I>>>7);r=n[2*(t-2)];var q,I=((q=n[2*(t-2)+1])<<13|r>>>19)^(r<<3|q>>>29)^r>>>6,q=(r<<13|q>>>19)^(q<<3|r>>>29)^(r<<26|q>>>6),G=n[2*(t-7)],Q=n[2*(t-16)],W=n[2*(t-16)+1];e=e+G+((r=T+n[2*(t-7)+1])>>>0<T>>>0?1:0),e+=I+((r+=q)>>>0<q>>>0?1:0),e+=Q+((r+=W)>>>0<W>>>0?1:0)}n[2*t]=e|=0,n[2*t+1]=r|=0;var G=V&S^~V&P,Y=M&D^~M&R,q=A&B^A&E^B&E,X=L&C^L&U^C&U,Q=(L<<4|A>>>28)^(A<<30|L>>>2)^(A<<25|L>>>7),W=(A<<4|L>>>28)^(L<<30|A>>>2)^(L<<25|A>>>7),_=s[2*t],F=s[2*t+1],I,T,I,T,I,T,I,T=(T=(T=(T=O+((M<<18|V>>>14)^(M<<14|V>>>18)^(V<<23|M>>>9))+((I=z+((V<<18|M>>>14)^(V<<14|M>>>18)^(M<<23|V>>>9)))>>>0<z>>>0?1:0))+(G+((I=I+Y)>>>0<Y>>>0?1:0)))+(_+((I=I+F)>>>0<F>>>0?1:0)))+(e+((I=I+r|0)>>>0<r>>>0?1:0));e=Q+q+((r=W+X)>>>0<W>>>0?1:0),O=P,z=R,P=S,R=D,S=V,D=M,V=k+T+((M=x+I|0)>>>0<x>>>0?1:0)|0,k=E,x=U,E=B,U=C,B=A,C=L,A=T+e+((L=I+r|0)>>>0<I>>>0?1:0)|0}o=i[1]=o+L|0,i[0]=c+A+(o>>>0<L>>>0?1:0)|0,h=i[3]=h+C|0,i[2]=a+B+(h>>>0<C>>>0?1:0)|0,u=i[5]=u+U|0,i[4]=l+E+(u>>>0<U>>>0?1:0)|0,d=i[7]=d+x|0,i[6]=f+k+(d>>>0<x>>>0?1:0)|0,y=i[9]=y+M|0,i[8]=p+V+(y>>>0<M>>>0?1:0)|0,m=i[11]=m+D|0,i[10]=g+S+(m>>>0<D>>>0?1:0)|0,v=i[13]=v+R|0,i[12]=b+P+(v>>>0<R>>>0?1:0)|0,w=i[15]=w+z|0,i[14]=j+O+(w>>>0<z>>>0?1:0)|0}},sjcl.mode.ccm={name:\"ccm\",s:[],listenProgress:function(t){sjcl.mode.ccm.s.push(t)},unListenProgress:function(t){-1<(t=sjcl.mode.ccm.s.indexOf(t))&&sjcl.mode.ccm.s.splice(t,1)},H:function(t){var e=sjcl.mode.ccm.s.slice(),r;for(r=0;r<e.length;r+=1)e[r](t)},encrypt:function(t,e,n,i,s){var c,o=e.slice(0),a=sjcl.bitArray,h=a.bitLength(n)/8,l=a.bitLength(o)/8;for(s=s||64,i=i||[],7>h&&r(new sjcl.exception.invalid(\"ccm: iv must be at least 7 bytes\")),c=2;4>c&&l>>>8*c;c++);return c<15-h&&(c=15-h),n=a.clamp(n,8*(15-c)),e=sjcl.mode.ccm.o(t,e,n,i,s,c),o=sjcl.mode.ccm.p(t,o,n,e,s,c),a.concat(o.data,o.tag)},decrypt:function(t,e,n,i,s){s=s||64,i=i||[];var c=sjcl.bitArray,o=c.bitLength(n)/8,a=c.bitLength(e),h=c.clamp(e,a-s),l=c.bitSlice(e,a-s),a=(a-s)/8;for(7>o&&r(new sjcl.exception.invalid(\"ccm: iv must be at least 7 bytes\")),e=2;4>e&&a>>>8*e;e++);return e<15-o&&(e=15-o),n=c.clamp(n,8*(15-e)),h=sjcl.mode.ccm.p(t,h,n,l,s,e),t=sjcl.mode.ccm.o(t,h.data,n,i,s,e),c.equal(h.tag,t)||r(new sjcl.exception.corrupt(\"ccm: tag doesn't match\")),h.data},K:function(t,e,r,n,i,s){var c=[],o=sjcl.bitArray,a=o.u;if(n=[o.partial(8,(e.length?64:0)|n-2<<2|s-1)],(n=o.concat(n,r))[3]|=i,n=t.encrypt(n),e.length)for(65279>=(r=o.bitLength(e)/8)?c=[o.partial(16,r)]:4294967295>=r&&(c=o.concat([o.partial(16,65534)],[r])),c=o.concat(c,e),e=0;e<c.length;e+=4)n=t.encrypt(a(n,c.slice(e,e+4).concat([0,0,0])));return n},o:function(t,e,n,i,s,c){var o=sjcl.bitArray,a=o.u;for(((s/=8)%2||4>s||16<s)&&r(new sjcl.exception.invalid(\"ccm: invalid tag length\")),(4294967295<i.length||4294967295<e.length)&&r(new sjcl.exception.bug(\"ccm: can't deal with 4GiB or more data\")),n=sjcl.mode.ccm.K(t,i,n,s,o.bitLength(e)/8,c),i=0;i<e.length;i+=4)n=t.encrypt(a(n,e.slice(i,i+4).concat([0,0,0])));return o.clamp(n,8*s)},p:function(t,e,r,n,i,s){var c,o=sjcl.bitArray;c=o.u;var a=e.length,h=o.bitLength(e),l=a/50,u=l;if(r=o.concat([o.partial(8,s-1)],r).concat([0,0,0]).slice(0,4),n=o.bitSlice(c(n,t.encrypt(r)),0,i),!a)return{tag:n,data:[]};for(c=0;c<a;c+=4)c>l&&(sjcl.mode.ccm.H(c/a),l+=u),r[3]++,i=t.encrypt(r),e[c]^=i[0],e[c+1]^=i[1],e[c+2]^=i[2],e[c+3]^=i[3];return{tag:n,data:o.clamp(e,h)}}},sjcl.prng=function(t){this.f=[new sjcl.hash.sha256],this.j=[0],this.F=0,this.t={},this.D=0,this.J={},this.L=this.g=this.k=this.S=0,this.b=[0,0,0,0,0,0,0,0],this.h=[0,0,0,0],this.B=s,this.C=t,this.r=v,this.A={progress:{},seeded:{}},this.m=this.R=0,this.v=1,this.w=2,this.O=65536,this.G=[0,48,64,96,128,192,256,384,512,768,1024],this.P=3e4,this.N=80},sjcl.prng.prototype={randomWords:function(t,e){var n=[],i,s;if((i=this.isReady(e))===this.m&&r(new sjcl.exception.notReady(\"generator isn't seeded\")),i&this.w){i=!(i&this.v),s=[];var c=0,o;for(this.L=s[0]=(new Date).valueOf()+this.P,o=0;16>o;o++)s.push(4294967296*Math.random()|0);for(o=0;o<this.f.length&&(s=s.concat(this.f[o].finalize()),c+=this.j[o],this.j[o]=0,i||!(this.F&1<<o));o++);for(this.F>=1<<this.f.length&&(this.f.push(new sjcl.hash.sha256),this.j.push(0)),this.g-=c,c>this.k&&(this.k=c),this.F++,this.b=sjcl.hash.sha256.hash(this.b.concat(s)),this.B=new sjcl.cipher.aes(this.b),i=0;4>i&&(this.h[i]=this.h[i]+1|0,!this.h[i]);i++);}for(i=0;i<t;i+=4)0==(i+1)%this.O&&ba(this),s=ca(this),n.push(s[0],s[1],s[2],s[3]);return ba(this),n.slice(0,t)},setDefaultParanoia:function(t,e){0===t&&\"Setting paranoia=0 will ruin your security; use it only for testing\"!==e&&r(\"Setting paranoia=0 will ruin your security; use it only for testing\"),this.C=t},addEntropy:function(t,e,n){n=n||\"user\";var i,c,o=(new Date).valueOf(),a=this.t[n],h=this.isReady(),l=0;switch((i=this.J[n])===s&&(i=this.J[n]=this.S++),a===s&&(a=this.t[n]=0),this.t[n]=(this.t[n]+1)%this.f.length,typeof t){case\"number\":e===s&&(e=1),this.f[a].update([i,this.D++,1,e,o,1,0|t]);break;case\"object\":if(\"[object Uint32Array]\"===(n=Object.prototype.toString.call(t))){for(c=[],n=0;n<t.length;n++)c.push(t[n]);t=c}else for(\"[object Array]\"!==n&&(l=1),n=0;n<t.length&&!l;n++)\"number\"!=typeof t[n]&&(l=1);if(!l){if(e===s)for(n=e=0;n<t.length;n++)for(c=t[n];0<c;)e++,c>>>=1;this.f[a].update([i,this.D++,2,e,o,t.length].concat(t))}break;case\"string\":e===s&&(e=t.length),this.f[a].update([i,this.D++,3,e,o,t.length]),this.f[a].update(t);break;default:l=1}l&&r(new sjcl.exception.bug(\"random: addEntropy only supports number, array of numbers or string\")),this.j[a]+=e,this.g+=e,h===this.m&&(this.isReady()!==this.m&&da(\"seeded\",Math.max(this.k,this.g)),da(\"progress\",this.getProgress()))},isReady:function(t){return t=this.G[t!==s?t:this.C],this.k&&this.k>=t?this.j[0]>this.N&&(new Date).valueOf()>this.L?this.w|this.v:this.v:this.g>=t?this.w|this.m:this.m},getProgress:function(t){return t=this.G[t||this.C],this.k>=t?1:this.g>t?1:this.g/t},startCollectors:function(){this.r||(this.a={loadTimeCollector:P(this,this.W),mouseCollector:P(this,this.X),keyboardCollector:P(this,this.U),accelerometerCollector:P(this,this.Q),touchCollector:P(this,this.Y)},window.addEventListener?(window.addEventListener(\"load\",this.a.loadTimeCollector,v),window.addEventListener(\"mousemove\",this.a.mouseCollector,v),window.addEventListener(\"keypress\",this.a.keyboardCollector,v),window.addEventListener(\"devicemotion\",this.a.accelerometerCollector,v),window.addEventListener(\"touchmove\",this.a.touchCollector,v)):document.attachEvent?(document.attachEvent(\"onload\",this.a.loadTimeCollector),document.attachEvent(\"onmousemove\",this.a.mouseCollector),document.attachEvent(\"keypress\",this.a.keyboardCollector)):r(new sjcl.exception.bug(\"can't attach event\")),this.r=!0)},stopCollectors:function(){this.r&&(window.removeEventListener?(window.removeEventListener(\"load\",this.a.loadTimeCollector,v),window.removeEventListener(\"mousemove\",this.a.mouseCollector,v),window.removeEventListener(\"keypress\",this.a.keyboardCollector,v),window.removeEventListener(\"devicemotion\",this.a.accelerometerCollector,v),window.removeEventListener(\"touchmove\",this.a.touchCollector,v)):document.detachEvent&&(document.detachEvent(\"onload\",this.a.loadTimeCollector),document.detachEvent(\"onmousemove\",this.a.mouseCollector),document.detachEvent(\"keypress\",this.a.keyboardCollector)),this.r=v)},addEventListener:function(t,e){this.A[t][this.R++]=e},removeEventListener:function(t,e){var r,n,i=this.A[t],s=[];for(n in i)i.hasOwnProperty(n)&&i[n]===e&&s.push(n);for(r=0;r<s.length;r++)delete i[n=s[r]]},U:function(){Q(1)},X:function(t){var e,r;try{e=t.x||t.clientX||t.offsetX||0,r=t.y||t.clientY||t.offsetY||0}catch(t){r=e=0}0!=e&&0!=r&&sjcl.random.addEntropy([e,r],2,\"mouse\"),Q(0)},Y:function(t){t=t.touches[0]||t.changedTouches[0],sjcl.random.addEntropy([t.pageX||t.clientX,t.pageY||t.clientY],1,\"touch\"),Q(0)},W:function(){Q(2)},Q:function(t){if(t=t.accelerationIncludingGravity.x||t.accelerationIncludingGravity.y||t.accelerationIncludingGravity.z,window.orientation){var e=window.orientation;\"number\"==typeof e&&sjcl.random.addEntropy(e,1,\"accelerometer\")}t&&sjcl.random.addEntropy(t,2,\"accelerometer\"),Q(0)}},sjcl.random=new sjcl.prng(6);t:try{var V,ea,W,fa;if(fa=\"undefined\"!=typeof module){var ka;if(ka=module.exports){var la;try{la=require(\"crypto\")}catch(t){la=null}ka=(ea=la)&&ea.randomBytes}fa=ka}if(fa)V=ea.randomBytes(128),V=new Uint32Array(new Uint8Array(V).buffer),sjcl.random.addEntropy(V,1024,\"crypto['randomBytes']\");else if(\"undefined\"!=typeof window&&\"undefined\"!=typeof Uint32Array){if(W=new Uint32Array(32),window.crypto&&window.crypto.getRandomValues)window.crypto.getRandomValues(W);else{if(!window.msCrypto||!window.msCrypto.getRandomValues)break t;window.msCrypto.getRandomValues(W)}sjcl.random.addEntropy(W,1024,\"crypto['getRandomValues']\")}}catch(t){\"undefined\"!=typeof window&&window.console&&(console.log(\"There was an error collecting entropy from the browser:\"),console.log(t))}sjcl.arrayBuffer=sjcl.arrayBuffer||{},\"undefined\"==typeof ArrayBuffer&&((a=this).ArrayBuffer=function(){},a.DataView=function(){}),sjcl.arrayBuffer.ccm={mode:\"ccm\",defaults:{tlen:128},compat_encrypt:function(t,e,r,n,i){var s=sjcl.codec.arrayBuffer.fromBits(e,!0,16);return e=sjcl.bitArray.bitLength(e)/8,n=n||[],t=sjcl.arrayBuffer.ccm.encrypt(t,s,r,n,i||64,e),r=sjcl.codec.arrayBuffer.toBits(t.ciphertext_buffer),r=sjcl.bitArray.clamp(r,8*e),sjcl.bitArray.concat(r,t.tag)},compat_decrypt:function(t,e,r,n,i){i=i||64,n=n||[];var s=sjcl.bitArray,c=s.bitLength(e),o=s.clamp(e,c-i);return e=s.bitSlice(e,c-i),o=sjcl.codec.arrayBuffer.fromBits(o,!0,16),t=sjcl.arrayBuffer.ccm.decrypt(t,o,r,e,n,i,(c-i)/8),sjcl.bitArray.clamp(sjcl.codec.arrayBuffer.toBits(t),c-i)},encrypt:function(t,e,r,n,i,s){var c,o=sjcl.bitArray,a=o.bitLength(r)/8;for(n=n||[],i=i||sjcl.arrayBuffer.ccm.defaults.tlen,s=s||e.byteLength,i=Math.ceil(i/8),c=2;4>c&&s>>>8*c;c++);return c<15-a&&(c=15-a),r=o.clamp(r,8*(15-c)),n=sjcl.arrayBuffer.ccm.o(t,e,r,n,i,s,c),{ciphertext_buffer:e,tag:n=sjcl.arrayBuffer.ccm.p(t,e,r,n,i,c)}},decrypt:function(t,e,n,i,s,c,o){var a,h=sjcl.bitArray,l=h.bitLength(n)/8;for(s=s||[],c=c||sjcl.arrayBuffer.ccm.defaults.tlen,o=o||e.byteLength,c=Math.ceil(c/8),a=2;4>a&&o>>>8*a;a++);return a<15-l&&(a=15-l),n=h.clamp(n,8*(15-a)),i=sjcl.arrayBuffer.ccm.p(t,e,n,i,c,a),t=sjcl.arrayBuffer.ccm.o(t,e,n,s,c,o,a),sjcl.bitArray.equal(i,t)||r(new sjcl.exception.corrupt(\"ccm: tag doesn't match\")),e},o:function(t,e,r,n,i,s,c){if(r=sjcl.mode.ccm.K(t,n,r,i,s,c),0!==e.byteLength){for(n=new DataView(e);s<e.byteLength;s++)n.setUint8(s,0);for(s=0;s<n.byteLength;s+=16)r[0]^=n.getUint32(s),r[1]^=n.getUint32(s+4),r[2]^=n.getUint32(s+8),r[3]^=n.getUint32(s+12),r=t.encrypt(r)}return sjcl.bitArray.clamp(r,8*i)},p:function(t,e,r,n,i,s){var c,o,a,h,l;o=(c=sjcl.bitArray).u;var u=e.byteLength/50,f=u;if(new DataView(new ArrayBuffer(16)),r=c.concat([c.partial(8,s-1)],r).concat([0,0,0]).slice(0,4),n=c.bitSlice(o(n,t.encrypt(r)),0,8*i),r[3]++,0===r[3]&&r[2]++,0!==e.byteLength)for(i=new DataView(e),l=0;l<i.byteLength;l+=16)l>u&&(sjcl.mode.ccm.H(l/e.byteLength),u+=f),h=t.encrypt(r),c=i.getUint32(l),o=i.getUint32(l+4),s=i.getUint32(l+8),a=i.getUint32(l+12),i.setUint32(l,c^h[0]),i.setUint32(l+4,o^h[1]),i.setUint32(l+8,s^h[2]),i.setUint32(l+12,a^h[3]),r[3]++,0===r[3]&&r[2]++;return n}},\"undefined\"==typeof ArrayBuffer&&function(t){t.ArrayBuffer=function(){},t.DataView=function(){}}(this),sjcl.codec.arrayBuffer={fromBits:function(t,e,n){var i;if(e=e==s||e,n=n||8,0===t.length)return new ArrayBuffer(0);for(i=sjcl.bitArray.bitLength(t)/8,0!=sjcl.bitArray.bitLength(t)%8&&r(new sjcl.exception.invalid(\"Invalid bit size, must be divisble by 8 to fit in an arraybuffer correctly\")),e&&0!=i%n&&(i+=n-i%n),n=new DataView(new ArrayBuffer(4*t.length)),e=0;e<t.length;e++)n.setUint32(4*e,t[e]<<32);if((t=new DataView(new ArrayBuffer(i))).byteLength===n.byteLength)return n.buffer;for(i=n.byteLength<t.byteLength?n.byteLength:t.byteLength,e=0;e<i;e++)t.setUint8(e,n.getUint8(e));return t.buffer},toBits:function(t){var e=[],r,n,i;if(0===t.byteLength)return[];for(r=(n=new DataView(t)).byteLength-n.byteLength%4,t=0;t<r;t+=4)e.push(n.getUint32(t));if(0!=n.byteLength%4){i=new DataView(new ArrayBuffer(4)),t=0;for(var s=n.byteLength%4;t<s;t++)i.setUint8(t+4-s,n.getUint8(r+t));e.push(sjcl.bitArray.partial(n.byteLength%4*8,i.getUint32(0)))}return e},Z:function(t){function e(t){return 4<=(t+=\"\").length?t:Array(4-t.length+1).join(\"0\")+t}t=new DataView(t);for(var r=\"\",n=0;n<t.byteLength;n+=2)0==n%16&&(r+=\"\\n\"+n.toString(16)+\"\\t\"),r+=e(t.getUint16(n).toString(16))+\" \";typeof console===s&&(console=console||{log:function(){}}),console.log(r.toUpperCase())}};\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIjAiXSwibmFtZXMiOlsiciIsImEiLCJzIiwidiIsIkgiLCJzamNsIiwiY2lwaGVyIiwiaGFzaCIsImtleWV4Y2hhbmdlIiwibW9kZSIsIm1pc2MiLCJjb2RlYyIsImV4Y2VwdGlvbiIsImNvcnJ1cHQiLCJ0aGlzIiwidG9TdHJpbmciLCJtZXNzYWdlIiwiaW52YWxpZCIsImJ1ZyIsIm5vdFJlYWR5IiwiYWEiLCJiIiwiYyIsImxlbmd0aCIsImQiLCJlIiwiZyIsImYiLCJoIiwiayIsIm4iLCJsIiwibSIsInAiLCJ3IiwiRCIsIkIiLCJFIiwiQyIsImRhIiwicmFuZG9tIiwiQSIsImhhc093blByb3BlcnR5IiwicHVzaCIsIlEiLCJ3aW5kb3ciLCJwZXJmb3JtYW5jZSIsIm5vdyIsImFkZEVudHJvcHkiLCJEYXRlIiwidmFsdWVPZiIsImJhIiwiY2EiLCJjb25jYXQiLCJhZXMiLCJlbmNyeXB0IiwiUCIsImFwcGx5IiwiYXJndW1lbnRzIiwibW9kdWxlIiwiZXhwb3J0cyIsImRlZmluZSIsInEiLCJzbGljZSIsInByb3RvdHlwZSIsImRlY3J5cHQiLCJiaXRBcnJheSIsImJpdFNsaWNlIiwiTSIsImNsYW1wIiwiZXh0cmFjdCIsIk1hdGgiLCJmbG9vciIsImdldFBhcnRpYWwiLCJiaXRMZW5ndGgiLCJjZWlsIiwicGFydGlhbCIsInJvdW5kIiwiZXF1YWwiLCJwb3AiLCJ1IiwiYnl0ZXN3YXBNIiwidXRmOFN0cmluZyIsImZyb21CaXRzIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwiZGVjb2RlVVJJQ29tcG9uZW50IiwiZXNjYXBlIiwidG9CaXRzIiwidW5lc2NhcGUiLCJlbmNvZGVVUklDb21wb25lbnQiLCJjaGFyQ29kZUF0IiwiYmFzZTY0IiwiSSIsInN1YnN0ciIsImNoYXJBdCIsInJlcGxhY2UiLCJpbmRleE9mIiwiYmFzZTY0dXJsIiwiYnl0ZXMiLCJzaGEyNTYiLCJyZXNldCIsInVwZGF0ZSIsImZpbmFsaXplIiwiYmxvY2tTaXplIiwiaSIsInNwbGljZSIsInBvdyIsInNoYTUxMiIsIlQiLCJWIiwiZ2EiLCJSIiwiaGEiLCJTIiwieCIsInQiLCJGIiwiSiIsIkciLCJYIiwiSyIsInkiLCJMIiwiVSIsIlkiLCJOIiwieiIsIloiLCIkIiwiTyIsImlhIiwibWEiLCJuYSIsImphIiwiY2NtIiwibmFtZSIsImxpc3RlblByb2dyZXNzIiwidW5MaXN0ZW5Qcm9ncmVzcyIsIm8iLCJkYXRhIiwidGFnIiwicHJuZyIsImoiLCJwcm9ncmVzcyIsInNlZWRlZCIsInJhbmRvbVdvcmRzIiwiaXNSZWFkeSIsInNldERlZmF1bHRQYXJhbm9pYSIsIk9iamVjdCIsImNhbGwiLCJtYXgiLCJnZXRQcm9ncmVzcyIsInN0YXJ0Q29sbGVjdG9ycyIsImxvYWRUaW1lQ29sbGVjdG9yIiwiVyIsIm1vdXNlQ29sbGVjdG9yIiwia2V5Ym9hcmRDb2xsZWN0b3IiLCJhY2NlbGVyb21ldGVyQ29sbGVjdG9yIiwidG91Y2hDb2xsZWN0b3IiLCJhZGRFdmVudExpc3RlbmVyIiwiZG9jdW1lbnQiLCJhdHRhY2hFdmVudCIsInN0b3BDb2xsZWN0b3JzIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImRldGFjaEV2ZW50IiwiY2xpZW50WCIsIm9mZnNldFgiLCJjbGllbnRZIiwib2Zmc2V0WSIsInRvdWNoZXMiLCJjaGFuZ2VkVG91Y2hlcyIsInBhZ2VYIiwicGFnZVkiLCJhY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5Iiwib3JpZW50YXRpb24iLCJlYSIsImZhIiwia2EiLCJsYSIsInJlcXVpcmUiLCJvYSIsInJhbmRvbUJ5dGVzIiwiVWludDMyQXJyYXkiLCJVaW50OEFycmF5IiwiYnVmZmVyIiwiY3J5cHRvIiwiZ2V0UmFuZG9tVmFsdWVzIiwibXNDcnlwdG8iLCJwYSIsImNvbnNvbGUiLCJsb2ciLCJhcnJheUJ1ZmZlciIsIkFycmF5QnVmZmVyIiwiRGF0YVZpZXciLCJkZWZhdWx0cyIsInRsZW4iLCJjb21wYXRfZW5jcnlwdCIsImNpcGhlcnRleHRfYnVmZmVyIiwiY29tcGF0X2RlY3J5cHQiLCJieXRlTGVuZ3RoIiwic2V0VWludDgiLCJnZXRVaW50MzIiLCJzZXRVaW50MzIiLCJnZXRVaW50OCIsIkFycmF5Iiwiam9pbiIsImdldFVpbnQxNiIsInRvVXBwZXJDYXNlIl0sIm1hcHBpbmdzIjoiQUFFQSxhQUFhLFNBQVNBLEVBQUVDLEdBQUcsTUFBTUEsRUFBRyxJQUFJQyxPQUFFLEVBQU9DLEdBQUUsRUFBRyxTQUFTQyxJQUFJLE9BQU8sYUFBYyxJQUFJQyxNQUFNQyxVQUFVQyxRQUFRQyxlQUFlQyxRQUFRQyxRQUFRQyxTQUFTQyxXQUFXQyxRQUFRLFNBQVNaLEdBQUdhLEtBQUtDLFNBQVMsV0FBVyxNQUFNLFlBQVlELEtBQUtFLFNBQVNGLEtBQUtFLFFBQVFmLEdBQUdnQixRQUFRLFNBQVNoQixHQUFHYSxLQUFLQyxTQUFTLFdBQVcsTUFBTSxZQUFZRCxLQUFLRSxTQUFTRixLQUFLRSxRQUFRZixHQUFHaUIsSUFBSSxTQUFTakIsR0FBR2EsS0FBS0MsU0FBUyxXQUFXLE1BQU0sUUFBUUQsS0FBS0UsU0FBU0YsS0FBS0UsUUFBUWYsR0FBR2tCLFNBQVMsU0FBU2xCLEdBQUdhLEtBQUtDLFNBQVMsV0FBVyxNQUFNLGNBQWNELEtBQUtFLFNBQVNGLEtBQUtFLFFBQVFmLEtBQTI0akJBLEVBQXRzaEIsU0FBU21CLEdBQUduQixFQUFFb0IsRUFBRUMsR0FBRyxJQUFJRCxFQUFFRSxRQUFRdkIsRUFBRSxJQUFJSyxLQUFLTyxVQUFVSyxRQUFRLDJCQUEyQixJQUFJTyxFQUFFdkIsRUFBRW9CLEVBQUVDLEdBQUdHLEVBQUVKLEVBQUUsR0FBR0csRUFBRSxHQUFHRSxFQUFFTCxFQUFFQyxFQUFFLEVBQUUsR0FBR0UsRUFBRSxHQUFHRyxFQUFFTixFQUFFLEdBQUdHLEVBQUUsR0FBR0gsRUFBRUEsRUFBRUMsRUFBRSxFQUFFLEdBQUdFLEVBQUUsR0FBRyxJQUFJSSxFQUFFQyxFQUFFQyxFQUFFQyxFQUFFUCxFQUFFRCxPQUFPLEVBQUUsRUFBRVMsRUFBRUMsRUFBRSxFQUFFQyxHQUFH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",
            'smalltalk.js': "\"use strict\";$(\"head\").append(\"<style>.smalltalk{display:flex;align-items:center;flex-direction:column;justify-content:center;transition:200ms opacity;bottom:0;left:0;overflow:auto;padding:20px;position:fixed;right:0;top:0;z-index:100}.smalltalk + .smalltalk{transition:ease 1s;display:none}.smalltalk .page{border-radius:3px;background:white;box-shadow:0 4px 23px 5px rgba(0, 0, 0, .2), 0 2px 6px rgba(0, 0, 0, .15);color:#333;min-width:400px;padding:0;position:relative;z-index:0}@media only screen and (max-width: 500px){.smalltalk .page{min-width:0}}.smalltalk .page > .close-button{background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAQAAAC1QeVaAAAAUklEQVR4XqXPYQrAIAhAYW/gXd8NJxTopVqsGEhtf+L9/ERU2k/HSMFQpKcYJeNFI9Be0LCMij8cYyjj5EHIivGBkwLfrbX3IF8PqumVmnDpEG+eDsKibPG2JwAAAABJRU5ErkJggg==') no-repeat center;height:14px;position:absolute;right:7px;top:7px;width:14px;z-index:1}.smalltalk .page > .close-button:hover{background-image:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAQAAAC1QeVaAAAAnUlEQVR4XoWQQQ6CQAxFewjkJkMCyXgJPMk7AiYczyBeZEAX6AKctGIaN+bt+trk9wtGQc/IkhnoKGxqqiWxOSZalapWFZ6VrIUDExsN0a5JRBq9LoVOR0eEQMoEhKizXhhsn0p1sCWVo7CwOf1RytPL8CPvwuBUoHL6ugeK30CVD1TqK7V/hdpe+VNChhOzV8xWny/+xosHF8578W/Hmc1OOC3wmwAAAABJRU5ErkJggg==')}.smalltalk .page header{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:500px;user-select:none;color:#333;font-size:120%;font-weight:bold;margin:0;padding:14px 17px;text-shadow:white 0 1px 2px}.smalltalk .page .content-area{overflow:hidden;text-overflow:ellipsis;padding:6px 17px;position:relative}.smalltalk .page .action-area{padding:14px 17px}button{font-family:Ubuntu, Arial, sans-serif}.smalltalk .smalltalk,.smalltalk button{min-height:2em;min-width:4em}.smalltalk button{appearance:none;user-select:none;background-image:linear-gradient(#ededed, #ededed 38%, #dedede);border:1px solid rgba(0, 0, 0, 0.25);border-radius:2px;box-shadow:0 1px 0 rgba(0, 0, 0, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.75);color:#444;font:inherit;margin:0 1px 0 0;text-shadow:0 1px 0 rgb(240, 240, 240)}.smalltalk button::-moz-focus-inner{border:0}.smalltalk button:enabled:active{background-image:linear-gradient(#e7e7e7, #e7e7e7 38%, #d7d7d7);box-shadow:none;text-shadow:none}.smalltalk .page .button-strip{display:flex;flex-direction:row;justify-content:flex-end}.smalltalk .page .button-strip > button{margin-left:10px}.smalltalk input{width:100%;border:1px solid #bfbfbf;border-radius:2px;box-sizing:border-box;color:#444;font:inherit;margin:0;min-height:2em;padding:3px;outline:none}.smalltalk button:enabled:focus,.smalltalk input:enabled:focus{transition:border-color 200ms;border-color:rgb(77, 144, 254);outline:none}\");const BUTTON_OK=[\"OK\"],BUTTON_OK_CANCEL=[\"OK\",\"Cancel\"],__smalltalk_remove=__smalltalk_bind(__smalltalk_removeEl,\".smalltalk\"),__smalltalk_store=t=>{const a={value:t};return function(t){return arguments.length?(a.value=t,t):a.value}};function _alert(t,a){return __smalltalk_showDialog(t,a,\"\",BUTTON_OK,{cancel:!1})}function _prompt(t,a,e=\"\",l){const n=__smalltalk_getType(l),o=String(e).replace(/\"/g,\"&quot;\"),s=`<input type=\"${n}\" value=\"${o}\" data-name=\"js-input\">`;return __smalltalk_showDialog(t,a,s,BUTTON_OK_CANCEL,l)}function _confirm(t,a,e){return __smalltalk_showDialog(t,a,\"\",BUTTON_OK_CANCEL,e)}function __smalltalk_getType(t={}){const{type:a}=t;return\"password\"===a?\"password\":\"text\"}function __smalltalk_getTemplate(t,a,e,l){const n=a.replace(/\\n/g,\"<br>\");return`<div class=\"page\">\\n        <div data-name=\"js-close\" class=\"close-button\"></div>\\n        <header>${t}</header>\\n        <div class=\"content-area\">${n}${e}</div>\\n        <div class=\"action-area\">\\n            <div class=\"button-strip\"> ${l.map((t,a)=>`<button tabindex=${a} data-name=\"js-${t.toLowerCase()}\">${t}</button>`).join(\"\")}\\n            </div>\\n        </div>\\n    </div>`}function __smalltalk_showDialog(t,a,e,l,n){const o=__smalltalk_store(),s=__smalltalk_store(),i=document.createElement(\"div\"),r=[\"cancel\",\"close\",\"ok\"],_=new Promise((t,a)=>{const e=n&&!n.cancel,l=()=>{};o(t),s(e?l:a)});return i.innerHTML=__smalltalk_getTemplate(t,a,e,l),i.className=\"smalltalk\",document.body.appendChild(i),__smalltalk_find(i,[\"ok\",\"input\"]).forEach(t=>t.focus()),__smalltalk_find(i,[\"input\"]).forEach(t=>{t.setSelectionRange(0,e.length)}),__smalltalk_addListenerAll(\"click\",i,r,t=>__smalltalk_closeDialog(t.target,i,o(),s())),[\"click\",\"contextmenu\"].forEach(t=>i.addEventListener(t,()=>__smalltalk_find(i,[\"ok\",\"input\"]).forEach(t=>t.focus()))),i.addEventListener(\"keydown\",currify(__smalltalk_keyDownEvent)(i,o(),s())),_}function __smalltalk_keyDownEvent(t,a,e,l){const n={ENTER:13,ESC:27,TAB:9,LEFT:37,UP:38,RIGHT:39,DOWN:40},o=l.keyCode,s=l.target,i=[\"ok\",\"cancel\",\"input\"],r=__smalltalk_find(t,i).map(__smalltalk_getDataName);switch(o){case n.ENTER:__smalltalk_closeDialog(s,t,a,e),l.preventDefault();break;case n.ESC:__smalltalk_remove(),e();break;case n.TAB:l.shiftKey&&__smalltalk_tab(t,r),__smalltalk_tab(t,r),l.preventDefault();break;default:[\"left\",\"right\",\"up\",\"down\"].filter(t=>o===n[t.toUpperCase()]).forEach(()=>{__smalltalk_changeButtonFocus(t,r)})}l.stopPropagation()}function __smalltalk_getDataName(t){return t.getAttribute(\"data-name\").replace(\"js-\",\"\")}function __smalltalk_changeButtonFocus(t,a){const e=document.activeElement,l=__smalltalk_getDataName(e),n=/ok|cancel/.test(l),o=a.length-1,s=t=>\"cancel\"===t?\"ok\":\"cancel\";if(\"input\"===l||!o||!n)return;const i=s(l);__smalltalk_find(t,[i]).forEach(t=>{t.focus()})}const __smalltalk_getIndex=(t,a)=>a===t?0:a+1;function __smalltalk_tab(t,a){const e=document.activeElement,l=__smalltalk_getDataName(e),n=a.length-1,o=a.indexOf(l),s=__smalltalk_getIndex(n,o),i=a[s];__smalltalk_find(t,[i]).forEach(t=>t.focus())}function __smalltalk_closeDialog(t,a,e,l){const n=t.getAttribute(\"data-name\").replace(\"js-\",\"\");if(/close|cancel/.test(n))return l(),void __smalltalk_remove();const o=__smalltalk_find(a,[\"input\"]).reduce((t,a)=>a.value,null);e(o),__smalltalk_remove()}function __smalltalk_find(t,a){const e=t=>t,l=a.map(a=>t.querySelector(`[data-name=\"js-${a}\"]`)).filter(e);return l}function __smalltalk_addListenerAll(t,a,e,l){__smalltalk_find(a,e).forEach(a=>a.addEventListener(t,l))}function __smalltalk_removeEl(t){const a=document.querySelector(t);a.parentElement.removeChild(a)}function __smalltalk_bind(t,...a){return()=>t(...a)}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIjAiXSwibmFtZXMiOlsiJCIsImFwcGVuZCIsIkJVVFRPTl9PSyIsIkJVVFRPTl9PS19DQU5DRUwiLCJfX3NtYWxsdGFsa19yZW1vdmUiLCJfX3NtYWxsdGFsa19iaW5kIiwiX19zbWFsbHRhbGtfcmVtb3ZlRWwiLCJfX3NtYWxsdGFsa19zdG9yZSIsInZhbHVlIiwiZGF0YSIsImFyZ3VtZW50cyIsImxlbmd0aCIsIl9hbGVydCIsInRpdGxlIiwibXNnIiwiX19zbWFsbHRhbGtfc2hvd0RpYWxvZyIsImNhbmNlbCIsIl9wcm9tcHQiLCJvcHRpb25zIiwidHlwZSIsIl9fc21hbGx0YWxrX2dldFR5cGUiLCJ2YWwiLCJTdHJpbmciLCJyZXBsYWNlIiwidmFsdWVTdHIiLCJfY29uZmlybSIsIl9fc21hbGx0YWxrX2dldFRlbXBsYXRlIiwiYnV0dG9ucyIsImVuY29kZWRNc2ciLCJtYXAiLCJuYW1lIiwiaSIsInRvTG93ZXJDYXNlIiwiam9pbiIsIm9rIiwiZGlhbG9nIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiY2xvc2VCdXR0b25zIiwicHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0Iiwibm9DYW5jZWwiLCJlbXB0eSIsImlubmVySFRNTCIsImNsYXNzTmFtZSIsImJvZHkiLCJhcHBlbmRDaGlsZCIsIl9fc21hbGx0YWxrX2ZpbmQiLCJmb3JFYWNoIiwiZWwiLCJmb2N1cyIsInNldFNlbGVjdGlvblJhbmdlIiwiX19zbWFsbHRhbGtfYWRkTGlzdGVuZXJBbGwiLCJldmVudCIsIl9fc21hbGx0YWxrX2Nsb3NlRGlhbG9nIiwidGFyZ2V0IiwiYWRkRXZlbnRMaXN0ZW5lciIsImN1cnJpZnkiLCJfX3NtYWxsdGFsa19rZXlEb3duRXZlbnQiLCJLRVkiLCJFTlRFUiIsIkVTQyIsIlRBQiIsIkxFRlQiLCJVUCIsIlJJR0hUIiwiRE9XTiIsImtleUNvZGUiLCJuYW1lc0FsbCIsIm5hbWVzIiwiX19zbWFsbHRhbGtfZ2V0RGF0YU5hbWUiLCJwcmV2ZW50RGVmYXVsdCIsInNoaWZ0S2V5IiwiX19zbWFsbHRhbGtfdGFiIiwiZmlsdGVyIiwidG9VcHBlckNhc2UiLCJfX3NtYWxsdGFsa19jaGFuZ2VCdXR0b25Gb2N1cyIsInN0b3BQcm9wYWdhdGlvbiIsImdldEF0dHJpYnV0ZSIsImFjdGl2ZSIsImFjdGl2ZUVsZW1lbnQiLCJhY3RpdmVOYW1lIiwiaXNCdXR0b24iLCJ0ZXN0IiwiY291bnQiLCJnZXROYW1lIiwiX19zbWFsbHRhbGtfZ2V0SW5kZXgiLCJpbmRleCIsImFjdGl2ZUluZGV4IiwiaW5kZXhPZiIsInJlZHVjZSIsImVsZW1lbnQiLCJub3RFbXB0eSIsImEiLCJlbGVtZW50cyIsInF1ZXJ5U2VsZWN0b3IiLCJwYXJlbnQiLCJmbiIsInBhcmVudEVsZW1lbnQiLCJyZW1vdmVDaGlsZCIsImFyZ3MiXSwibWFwcGluZ3MiOiJBQUFBLGFBRUFBLEVBQUUsUUFBUUMsT0FBTyw2bkZBRWpCLE1BQU1DLFdBQWEsTUFDYkMsa0JBQW9CLEtBQU0sVUFFMUJDLG1CQUFxQkMsaUJBQWtCQyxxQkFBc0IsY0FHN0RDLGtCQUFzQkMsSUFDeEIsTUFBTUMsR0FDRkQsTUFBQUEsR0FHSixPQUFPLFNBQVdBLEdBQ2QsT0FBTUUsVUFBVUMsUUFHaEJGLEVBQUtELE1BQVFBLEVBRU5BLEdBSklDLEVBQUtELFFBUXhCLFNBQVNJLE9BQVFDLEVBQU9DLEdBQ3BCLE9BQU9DLHVCQUF3QkYsRUFBT0MsRUFBSyxHQUFJWixXQUFhYyxRQUFRLElBR3hFLFNBQVNDLFFBQVNKLEVBQU9DLEVBQUtOLEVBQVEsR0FBSVUsR0FDdEMsTUFBTUMsRUFBT0Msb0JBQXFCRixHQUU1QkcsRUFBTUMsT0FBUWQsR0FDZmUsUUFBUyxLQUFNLFVBRWRDLGtCQUE0QkwsYUFBa0JFLDJCQUVwRCxPQUFPTix1QkFBd0JGLEVBQU9DLEVBQUtVLEVBQVVyQixpQkFBa0JlLEdBRzNFLFNBQVNPLFNBQVVaLEVBQU9DLEVBQUtJLEdBQzNCLE9BQU9ILHVCQUF3QkYsRUFBT0MsRUFBSyxHQUFJWCxp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"
        };
    }

    /* ============================================================== */

    /* ===================== STANDARD CALLBACKS ===================== */

    /**
     * @public
     * @desc Starts the script execution. This is called by BetterDiscord if the plugin is enabled.
     */
    start() {
        /* Backup class instance. */
        const self = this;

        /* Perform idiot-proof check to make sure the user named the plugin `discordCrypt.plugin.js` */
        if ( !discordCrypt.validPluginName() ) {
            _alert(
                "Oops!\r\n\r\n" +
                "It seems you didn't read discordCrypt's usage guide. :(\r\n" +
                "You need to name this plugin exactly as follows to allow it to function correctly.\r\n\r\n" +
                `\t${discordCrypt.getPluginName()}\r\n\r\n\r\n` +
                "You should probably check the usage guide again just in case you missed anything else. :)",
                'Hi There! - DiscordCrypt'
            );
            return;
        }

        /* Perform startup and load the config file if not already loaded. */
        if ( !this.configFile ) {
            /* Load the master password. */
            this.loadMasterPassword();

            /* Don't do anything further till we have a configuration file. */
            return;
        }

        /* Add the toolbar. */
        this.loadToolbar();

        /* Attach the message handler. */
        this.attachHandler();

        /* Process any blocks on an interval since Discord loves to throttle messages. */
        this.scanInterval = setInterval( () => {
            self.decodeMessages();
        }, self.configFile.encryptScanDelay );

        /* The toolbar fails to properly load on switches to the friends list. Create an interval to do this. */
        this.toolbarReloadInterval = setInterval( () => {
            self.loadToolbar();
            self.attachHandler();
        }, 5000 );

        /* Don't check for updates if running a debug version. */
        if ( !discordCrypt.__shouldIgnoreUpdates( this.getVersion() ) ) {
            /* Check for any new updates. */
            this.checkForUpdates();

            /* Add an update handler to check for updates every 60 minutes. */
            this.updateHandlerInterval = setInterval( () => {
                self.checkForUpdates();
            }, 3600000 );
        }
    }

    /**
     * @public
     * @desc Stops the script execution. This is called by BetterDiscord if the plugin is disabled or during shutdown.
     */
    stop() {
        /* Nothing needs to be done since start() wouldn't have triggered. */
        if ( !discordCrypt.validPluginName() )
            return;

        /* Remove onMessage event handler hook. */
        $( this.channelTextAreaClass ).off( "keydown.dcrypt" );

        /* Unload the decryption interval. */
        clearInterval( this.scanInterval );

        /* Unload the toolbar reload interval. */
        clearInterval( this.toolbarReloadInterval );

        /* Unload the update handler. */
        clearInterval( this.updateHandlerInterval );

        /* Unload elements. */
        $( "#dc-overlay" ).remove();
        $( '#dc-lock-btn' ).remove();
        $( '#dc-passwd-btn' ).remove();
        $( '#dc-exchange-btn' ).remove();
        $( '#dc-settings-btn' ).remove();
        $( '#dc-toolbar-line' ).remove();

        /* Clear the configuration file. */
        this.configFile = null;
    }

    /**
     * @public
     * @desc Triggered when the script has to load resources. This is called once upon Discord startup.
     */
    load() {
        const vm = require( 'vm' );

        /* Inject application CSS. */
        discordCrypt.injectCSS( 'dc-css', this.appCss );

        /* Inject all compiled libraries. */
        for ( let name in this.libraries ) {
            vm.runInThisContext( this.libraries[ name ], {
                filename: name,
                displayErrors: false
            } );
        }
    }

    /**
     * @public
     * @desc Triggered when the script needs to unload its resources. This is called during Discord shutdown.
     */
    unload() {
        /* Clear the injected CSS. */
        discordCrypt.clearCSS( 'dc-css' );
    }

    /**
     * @public
     * @desc Triggered by BetterDiscord when the current channel has been switched.
     */
    onSwitch() {
        /* Skip if no valid configuration is loaded. */
        if ( !this.configFile )
            return;

        discordCrypt.log( 'Detected chat switch.', 'debug' );

        /* Add the toolbar. */
        this.loadToolbar();

        /* Attach the message handler. */
        this.attachHandler();

        /* Decrypt any messages. */
        this.decodeMessages();
    }

    /**
     * @public
     * @desc Triggered when the current channel or DM adds a new message to the display.
     *      Attempt to decode messages once a new message has been received.
     */
    onMessage() {
        /* Skip if no valid configuration is loaded. */
        if ( !this.configFile )
            return;

        discordCrypt.log( 'Detected new message.', 'Decoding ...', 'debug' );

        /* Immediately decode the message. */
        this.decodeMessages();
    }

    /* =================== END STANDARD CALLBACKS =================== */

    /* =================== CONFIGURATION DATA CBS =================== */

    /**
     * @private
     * @desc Performed when updating a configuration file across versions.
     */
    onUpdate() {
        /* Placeholder for future use. */
    }

    /**
     * @private
     * @desc Returns the default settings for the plugin.
     * @returns {
     *  {
     *      version: string,
     *      defaultPassword: string,
     *      encodeMessageTrigger: string,
     *      encryptScanDelay: number,
     *      encryptMode: number,
     *      encryptBlockMode: string,
     *      encodeAll: boolean,
     *      paddingMode: string,
     *      passList: {},
     *      up1Host: string,
     *      up1ApiKey: string
     *  }
     * }
     */
    getDefaultConfig() {
        return {
            /* Current Version. */
            version: this.getVersion(),
            /* Default password for servers not set. */
            defaultPassword: "秘一密比无为有秘习个界一万定为界人是的要人每的但了又你上着密定已",
            /* Defines what needs to be typed at the end of a message to encrypt it. */
            encodeMessageTrigger: "ENC",
            /* How often to scan for encrypted messages. */
            encryptScanDelay: 1000,
            /* Default encryption mode. */
            encryptMode: 7, /* AES(Camellia) */
            /* Default block operation mode for ciphers. */
            encryptBlockMode: 'CBC',
            /* Encode all messages automatically when a password has been set. */
            encodeAll: true,
            /* Default padding mode for blocks. */
            paddingMode: 'PKC7',
            /* Password array of objects for users or channels. */
            passList: {},
            /* Contains the URL of the Up1 client. */
            up1Host: 'https://share.riseup.net',
            /* Contains the API key used for transactions with the Up1 host. */
            up1ApiKey: '59Mnk5nY6eCn4bi9GvfOXhMH54E7Bh6EMJXtyJfs'
        };
    }

    /**
     * @private
     * @desc Checks if the configuration file exists.
     * @returns {boolean} Returns true if the configuration file exists.
     */
    configExists() {
        /* Attempt to parse the configuration file. */
        let data = bdPluginStorage.get( this.getName(), 'config' );

        /* The returned data must be defined and non-empty. */
        return data && data !== null && data !== '';
    }

    /**
     * @private
     * @desc Loads the configuration file from `discordCrypt.config.json`
     * @returns {boolean}
     */
    loadConfig() {
        discordCrypt.log( 'Loading configuration file ...' );

        /* Attempt to parse the configuration file. */
        let data = bdPluginStorage.get( this.getName(), 'config' );

        /* Check if the config file exists. */
        if ( !data || data === null || data === '' ) {
            /* File doesn't exist, create a new one. */
            this.configFile = this.getDefaultConfig();

            /* Save the config. */
            this.saveConfig();

            /* Nothing further to do. */
            return true;
        }

        /* Try parsing the decrypted data. */
        try {
            this.configFile = JSON.parse(
                discordCrypt.aes256_decrypt_gcm( data.data, this.masterPassword, 'PKC7', 'utf8', false )
            );
        }
        catch ( err ) {
            discordCrypt.log( `Decryption of configuration file failed - ${err}`, 'error' );
            return false;
        }

        /* If it fails, return an error. */
        if ( !this.configFile || !this.configFile.version ) {
            discordCrypt.log( 'Decryption of configuration file failed.', 'error' );
            return false;
        }

        /* Check for version mismatch. */
        if ( this.configFile.version !== this.getVersion() ) {
            /* Perform whatever needs to be done before updating. */
            this.onUpdate();

            /* Preserve the old version for logging. */
            let oldVersion = this.configFile.version;

            /* Preserve the old password list before updating. */
            let oldCache = this.configFile.passList;

            /* Get the most recent default configuration. */
            this.configFile = this.getDefaultConfig();

            /* Now restore the password list. */
            this.configFile.passList = oldCache;

            /* Save the new configuration. */
            this.saveConfig();

            /* Alert. */
            discordCrypt.log( `Updated plugin version from v${oldVersion} to v${this.getVersion()}.` );
            return true;
        }

        discordCrypt.log( `Loaded configuration file! - v${this.configFile.version}` );
        return true;
    }

    /**
     * @private
     * @desc Saves the configuration file with the current password using AES-256 in GCM mode.
     */
    saveConfig() {
        discordCrypt.log( 'Saving configuration file ...' );

        /* Encrypt the message using the master password and save the encrypted data. */
        bdPluginStorage.set( this.getName(), 'config', {
            data:
                discordCrypt.aes256_encrypt_gcm(
                    JSON.stringify( this.configFile ),
                    this.masterPassword,
                    'PKC7',
                    false
                )
        } );
    }

    /**
     * @private
     * @desc Updates and saves the configuration data used and updates a given button's text.
     * @param {Object} btn The jQuery button to set the update text for.
     */
    saveSettings( btn ) {
        /* Save self. */
        const self = this;

        /* Clear the old message decoder. */
        clearInterval( this.scanInterval );

        /* Save the configuration file. */
        this.saveConfig();

        /* Set a new decoder to use any updated configurations. */
        setInterval( ( function () {
            self.decodeMessages( true );
        } ), this.configFile.encryptScanDelay );

        /* Tell the user that their settings were applied. */
        btn.innerHTML = "Saved & Applied!";

        /* Reset the original text after a second. */
        setTimeout( ( function () {
            btn.innerHTML = "Save & Apply";
        } ), 1000 );
    }

    /**
     * @private
     * @desc Resets the default configuration data used and updates a given button's text.
     * @param {Object} btn The jQuery button to set the update text for.
     */
    resetSettings( btn ) {
        /* Save self. */
        const self = this;

        /* Clear the old message decoder. */
        clearInterval( this.scanInterval );

        /* Retrieve the default configuration. */
        this.configFile = this.getDefaultConfig();

        /* Save the configuration file to update any settings. */
        this.saveConfig();

        /* Set a new decoder to use any updated configurations. */
        setInterval( ( function () {
            self.decodeMessages( true );
        } ), self.configFile.encryptScanDelay );

        /* Tell the user that their settings were reset. */
        btn.innerHTML = "Restored Default Settings!";

        /* Reset the original text after a second. */
        setTimeout( ( function () {
            btn.innerHTML = "Reset Settings";
        } ), 1000 );
    }

    /**
     * @private
     * @desc Update the current password field and save the config file.
     */
    updatePasswords() {
        /* Don't save if the password overlay is not open. */
        if ( $( '#dc-overlay-password' )[ 0 ].style.display !== 'block' )
            return;

        let prim = $( "#dc-password-primary" );
        let sec = $( "#dc-password-secondary" );

        /* Check if a primary password has actually been entered. */
        if ( !( prim[ 0 ].value !== '' && prim[ 0 ].value.length > 1 ) )
            delete this.configFile.passList[ discordCrypt.getChannelId() ];
        else {
            /* Update the password field for this id. */
            this.configFile.passList[ discordCrypt.getChannelId() ] =
                discordCrypt.createPassword( prim[ 0 ].value, '' );

            /* Only check for a secondary password if the primary password has been entered. */
            if ( sec[ 0 ].value !== '' && sec[ 0 ].value.length > 1 )
                this.configFile.passList[ discordCrypt.getChannelId() ].secondary = sec[ 0 ].value;

            /* Update the password toolbar. */
            prim[ 0 ].value = "";
            sec[ 0 ].value = "";
        }

        /* Save the configuration file and decode any messages. */
        this.saveConfig();

        /* Decode any messages with the new password(s). */
        this.decodeMessages( true );
    }

    /* ================= END CONFIGURATION CBS ================= */

    /* =================== PROJECT UTILITIES =================== */

    /**
     * @public
     * @desc Returns the name of the plugin file expected on the disk.
     * @returns {string}
     */
    static getPluginName() {
        return 'discordCrypt.plugin.js';
    }

    /**
     * @public
     * @desc Check if the plugin is named correctly by attempting to open the plugin file in the BetterDiscord
     *      plugin path.
     * @returns {boolean}
     */
    static validPluginName() {
        return require( 'fs' )
            .existsSync( require( 'path' )
                .join( discordCrypt.getPluginsPath(), discordCrypt.getPluginName() ) );
    }

    /**
     * @public
     * @desc Returns the platform-specific path to BetterDiscord's plugin directory.
     * @returns {string} The expected path ( which may not exist ) to BetterDiscord's plugin directory.
     */
    static getPluginsPath() {
        const process = require( 'process' );
        return `${process.platform === 'win32' ?
            process.env.APPDATA :
            process.platform === 'darwin' ?
                process.env.HOME + '/Library/Preferences' :
                process.env.HOME + '/.config'}/BetterDiscord/plugins/`;
    }

    /**
     * @callback updateCallback
     * @param {string} file_data The update file's data.
     * @param {string} short_hash A 64-bit SHA-256 checksum of the new update.
     * @param {string} new_version The new version of the update.
     * @param {string} full_changelog The full changelog.
     */

    /**
     * @public
     * @desc Checks the update server for an encrypted update.
     * @param {updateCallback} onUpdateCallback
     * @returns {boolean}
     * @example
     * checkForUpdate( ( file_data, short_hash, new_version, full_changelog ) =>
     *      console.log( `New Update Available: #${short_hash} - v${new_version}` );
     *      console.log( `Changelog:\n${full_changelog}` );
     * } );
     */
    static checkForUpdate( onUpdateCallback ) {
        /* Update URL and request method. */
        const update_url = `https://gitlab.com/leogx9r/DiscordCrypt/raw/master/src/${discordCrypt.getPluginName()}`;
        const changelog_url = 'https://gitlab.com/leogx9r/DiscordCrypt/raw/master/src/CHANGELOG';

        /* Make sure the callback is a function. */
        if ( typeof onUpdateCallback !== 'function' )
            return false;

        /* Perform the request. */
        try {
            /* Download the update. */
            discordCrypt.__getRequest( update_url, ( statusCode, errorString, data ) => {
                /* Make sure no error occurred. */
                if ( statusCode !== 200 ) {
                    /* Log the error accordingly. */
                    switch ( statusCode ) {
                        case 404:
                            discordCrypt.log( 'Update URL is broken.', 'error' );
                            break;
                        case 403:
                            discordCrypt.log( 'Forbidden request when checking for updates.', 'error' );
                            break;
                        default:
                            discordCrypt.log( `Error while fetching update: ${errorString}`, 'error' );
                            break;
                    }

                    return;
                }

                /* Format properly. */
                data = data.replace( '\r', '' );

                /* Get the local file. */
                let localFile = '//META{"name":"discordCrypt"}*//\n';
                try {
                    localFile = require( 'fs' ).readFileSync(
                        require( 'path' ).join(
                            discordCrypt.getPluginsPath(),
                            discordCrypt.getPluginName()
                        )
                    ).toString().replace( '\r', '' );
                }
                catch ( e ) {
                }

                /* Check the first line which contains the metadata to make sure that they're equal. */
                if ( data.split( '\n' )[ 0 ] !== localFile.split( '\n' )[ 0 ] ) {
                    discordCrypt.log( 'Plugin metadata is missing from either the local or update file.', 'error' );
                    return;
                }

                /* Read the current hash of the plugin and compare them.. */
                let currentHash = discordCrypt.sha256( localFile );
                let hash = discordCrypt.sha256( data );
                let shortHash = Buffer.from( hash, 'base64' )
                    .toString( 'hex' )
                    .slice( 0, 8 );

                /* If the hash equals the retrieved one, no update is needed. */
                if ( hash === currentHash ) {
                    discordCrypt.log( `No Update Needed - #${shortHash}` );
                    return true;
                }

                /* Try parsing a version number. */
                let version_number = '';
                try {
                    version_number = data.match( /('[0-9]+\.[0-9]+\.[0-9]+')/gi ).toString().replace( /('*')/g, '' );
                }
                catch ( e ) {
                }

                /* Now get the changelog. */
                try {
                    /* Fetch the changelog from the URL. */
                    discordCrypt.__getRequest( changelog_url, ( statusCode, errorString, changelog ) => {
                        /* Perform the callback. */
                        onUpdateCallback( data, shortHash, version_number, statusCode == 200 ? changelog : '' );
                    } );
                }
                catch ( e ) {
                    discordCrypt.log( 'Error fetching the changelog.', 'warn' );

                    /* Perform the callback without a changelog. */
                    onUpdateCallback( data, shortHash, version_number, '' );
                }
            } );
        }
        catch ( ex ) {
            /* Handle failure. */
            discordCrypt.log( `Error while retrieving update: ${ex.toString()}`, 'warn' );
            return false;
        }

        return true;
    }

    /**
     * @private
     * @description Returns the current message ID used by Discord.
     * @returns {string | undefined}
     */
    static getChannelId() {
        return window.location.pathname.split( '/' ).pop();
    }

    /**
     * @public
     * @desc Creates a password object using a primary and secondary password.
     * @param {string} primary_password The primary password.
     * @param {string} secondary_password The secondary password.
     * @returns {{primary: string, secondary: string}} Object containing the two passwords.
     */
    static createPassword( primary_password, secondary_password ) {
        return { primary: primary_password, secondary: secondary_password };
    }

    /**
     * @public
     * @desc Returns functions to locate exported webpack modules.
     * @returns {{find, findByUniqueProperties, findByDisplayName, findByDispatchToken, findByDispatchNames}}
     */
    static getWebpackModuleSearcher() {
        /* [ Credits to the creator. ] */
        const req = typeof( webpackJsonp ) === "function" ?
            webpackJsonp(
                [],
                { '__extra_id__': ( module, _export_, req ) => _export_.default = req },
                [ '__extra_id__' ]
            ).default :
            webpackJsonp.push( [
                [],
                { '__extra_id__': ( _module_, exports, req ) => _module_.exports = req },
                [ [ '__extra_id__' ] ] ]
            );

        delete req.m[ '__extra_id__' ];
        delete req.c[ '__extra_id__' ];

        /**
         * @desc Predicate for searching module.
         * @callback modulePredicate
         * @param {*} module Module to test.
         * @return {boolean} Returns `true` if `module` matches predicate.
         */

        /**
         * @desc Look through all modules of internal Discord's Webpack and return first one that matches filter
         *      predicate. At first this function will look through already loaded modules cache.
         *      If no loaded modules match, then this function tries to load all modules and match for them.
         *      Loading any module may have unexpected side effects, like changing current locale of moment.js,
         *      so in that case there will be a warning the console.
         *      If no module matches, this function returns `null`.
         *      ou should always try to provide a predicate that will match something,
         *      but your code should be ready to receive `null` in case of changes in Discord's codebase.
         *      If module is ES6 module and has default property, consider default first;
         *      otherwise, consider the full module object.
         * @param {modulePredicate} filter Predicate to match module
         * @param {boolean} force_load Whether to force load all modules if cached modules don't work.
         * @return {*} First module that matches `filter` or `null` if none match.
         */
        const find = ( filter, force_load ) => {
            for ( let i in req.c ) {
                if ( req.c.hasOwnProperty( i ) ) {
                    let m = req.c[ i ].exports;

                    if ( m && m.__esModule && m.default )
                        m = m.default;

                    if ( m && filter( m ) )
                        return m;
                }
            }

            if ( force_load ) {
                discordCrypt.log( "Couldn't find module in existing cache. Loading all modules.", 'warn' );

                for ( let i = 0; i < req.m.length; ++i ) {
                    try {
                        let m = req( i );
                        if ( m && m.__esModule && m.default && filter( m.default ) )
                            return m.default;
                        if ( m && filter( m ) )
                            return m;
                    }
                    catch ( e ) {
                    }
                }

                discordCrypt.log( 'Cannot find React module.', 'warn' );
            }

            return null;
        };

        /**
         * @desc Look through all modules of internal Discord's Webpack and return first object that has all of
         *      following properties. You should be ready that in any moment, after Discord update,
         *      this function may start returning `null` (if no such object exists anymore) or even some
         *      different object with the same properties. So you should provide all property names that
         *      you use, and often even some extra properties to make sure you'll get exactly what you want.
         * @param {string[]} propNames Array of property names to look for.
         * @param {boolean} [force_load] Whether to force load all modules if cached modules don't work.
         * @returns {object} First module that matches `propNames` or `null` if none match.
         */
        const findByUniqueProperties = ( propNames, force_load = true ) =>
            find( module => propNames.every( prop => module[ prop ] !== undefined ), force_load );

        /**
         * @desc Look through all modules of internal Discord's Webpack and return first object that has
         *      `displayName` property with following value. This is useful for searching for React components by
         *      name. Take into account that not all components are exported as modules. Also, there might be
         *      several components with the same name.
         * @param {string} displayName Display name property value to look for.
         * @param {boolean} [force_load] Whether to force load all modules if cached modules don't work.
         * @return {object} First module that matches `displayName` or `null` if none match.
         */
        const findByDisplayName = ( displayName, force_load = true ) =>
            find( module => module.displayName === displayName, force_load );

        /**
         * @desc Look through all modules of internal Discord's Webpack and return the first object that matches
         *      a dispatch token's ID. These usually contain a bundle of `_actionHandlers` used to handle events
         *      internally.
         * @param {int} token The internal token ID number.
         * @param {boolean} [force_load] Whether to force load all modules if cached modules don't work.
         * @return {object} First module that matches the dispatch ID or `null` if none match.
         */
        const findByDispatchToken = ( token, force_load = false ) =>
            find( module =>
                module[ '_dispatchToken' ] !== undefined &&
                module[ '_dispatchToken' ] === `ID_${token}` &&
                module[ '_actionHandlers' ] !== undefined,
                force_load
            );

        /**
         * @desc Look through all modules of internal Discord's Webpack and return the first object that matches
         *      every dispatcher name provided.
         * @param {string[]} dispatchNames Names of events to search for.
         * @return {object} First module that matches every dispatch name provided or null if no full matches.
         */
        const findByDispatchNames = dispatchNames => {
            for ( let i = 0; i < 500; i++ ) {
                let dispatcher = findByDispatchToken( i );

                if ( !dispatcher )
                    continue;

                if ( dispatchNames.every( prop => dispatcher._actionHandlers.hasOwnProperty( prop ) ) )
                    return dispatcher;
            }
            return null;
        };

        return { find, findByUniqueProperties, findByDisplayName, findByDispatchToken, findByDispatchNames };
    }

    /**
     * @private
     * @desc Dumps all function callback handlers with their names, IDs and function prototypes. [ Debug Function ]
     * @returns {Array} Returns an array of all IDs and identifier callbacks.
     */
    static dumpWebpackModuleCallbacks() {
        /* Resolve the finder function. */
        let finder = discordCrypt.getWebpackModuleSearcher().findByDispatchToken;

        /* Create the dumping array. */
        let dump = [];

        /* Iterate over let's say 500 possible modules ? In reality, there's < 100. */
        for ( let i = 0; i < 500; i++ ) {
            /* Locate the module. */
            let module = finder( i );

            /* Skip if it's invalid. */
            if ( !module )
                continue;

            /* Create an entry in the array. */
            dump[ i ] = {};

            /* Loop over every property name in the action handler. */
            for ( let prop in module._actionHandlers ) {

                /* Quick sanity check. */
                if ( !module._actionHandlers.hasOwnProperty( prop ) )
                    continue;

                /* Assign the module property name and it's basic prototype. */
                dump[ i ][ prop ] = module._actionHandlers[ prop ].prototype.constructor.toString().split( '{' )[ 0 ];
            }
        }

        /* Return any found module handlers. */
        return dump;
    }

    /**
     * @private
     * @desc Returns the React modules loaded natively in Discord.
     * @returns {{
     *      ChannelProps: Object|null,
     *      MessageParser: Object|null,
     *      MessageController: Object|null,
     *      MessageActionTypes: Object|null,
     *      MessageDispatcher: Object|null,
     *      MessageQueue: Object|null,
     *      HighlightJS: Object|null
     *  }}
     */
    static getReactModules() {
        const WebpackModules = discordCrypt.getWebpackModuleSearcher();

        return {
            ChannelProps:
                discordCrypt.getChannelId() === '@me' ?
                    null :
                    discordCrypt.__getElementReactOwner( $( 'form' )[ 0 ] ).props.channel,
            MessageParser: WebpackModules
                .findByUniqueProperties( [ 'createMessage', 'parse', 'unparse' ] ),
            MessageController: WebpackModules
                .findByUniqueProperties( [ "sendClydeError", "sendBotMessage" ] ),
            MessageActionTypes: WebpackModules
                .findByUniqueProperties( [ "ActionTypes", "ActivityTypes" ] ),
            MessageDispatcher: WebpackModules
                .findByUniqueProperties( [ "dispatch", "maybeDispatch", "dirtyDispatch" ] ),
            MessageQueue: WebpackModules
                .findByUniqueProperties( [ "enqueue", "handleSend", "handleResponse" ] ),
            HighlightJS: WebpackModules
                .findByUniqueProperties( [ 'initHighlighting', 'highlightBlock', 'highlightAuto' ] ),
        };
    }

    /**
     * @private
     * @desc Sends an embedded message to Discord.
     * @param {string} embedded_text The message body of the embed.
     * @param {string} embedded_header The text to display at the top of the embed.
     * @param {string} embedded_footer The text to display at the bottom of the embed.
     * @param {string|int} embedded_color A hex color used to outline the left side of the embed.
     * @param {string} message_content Message content to be attached above the embed.
     * @param {int|undefined} channel_id If specified, sends the embedded message to this channel instead of the
     *      current channel.
     */
    static sendEmbeddedMessage(
        /* string */ embedded_text,
        /* string */ embedded_header,
        /* string */ embedded_footer,
        /* int */    embedded_color = 0x551A8B,
        /* string */ message_content = '',
        /* int */    channel_id = undefined
    ) {
        let mention_everyone = false;

        /* Finds appropriate React modules. */
        const React = discordCrypt.getReactModules();

        /* Parse the message content to the required format if applicable.. */
        if ( typeof message_content === 'string' && message_content.length ) {
            /* Sanity check. */
            if ( React.MessageParser === null ) {
                discordCrypt.log( 'Could not locate the MessageParser module!', 'error' );
                return;
            }

            try {
                message_content = React.MessageParser.parse( React.ChannelProps, message_content ).content;

                /* Check for @everyone or @here mentions. */
                if ( message_content.includes( '@everyone' ) || message_content.includes( '@here' ) )
                    mention_everyone = true;
            }
            catch ( e ) {
                message_content = '';
            }
        }
        else
            message_content = '';

        /* Generate a unique nonce for this message. */
        let _nonce = parseInt( require( 'crypto' ).randomBytes( 6 ).toString( 'hex' ), 16 );

        /* Save the Channel ID. */
        let _channel = channel_id !== undefined ? channel_id : discordCrypt.getChannelId();

        /* Sanity check. */
        if ( React.MessageQueue === null ) {
            discordCrypt.log( 'Could not locate the MessageQueue module!', 'error' );
            return;
        }

        /* Create the message object and add it to the queue. */
        React.MessageQueue.enqueue( {
            type: 'send',
            message: {
                channelId: _channel,
                nonce: _nonce,
                content: message_content,
                mention_everyone: mention_everyone,
                tts: false,
                embed: {
                    type: "rich",
                    url: "https://gitlab.com/leogx9r/DiscordCrypt",
                    color: embedded_color || 0x551A8B,
                    timestamp: ( new Date() ).toISOString(),
                    output_mime_type: "text/x-html",
                    encoding: "utf-16",
                    author: {
                        name: embedded_header || '-----MESSAGE-----',
                        icon_url: 'https://i.imgur.com/NC0PcLA.png',
                        url: 'https://discord.me/discordCrypt'
                    },
                    footer: {
                        text: embedded_footer || 'DiscordCrypt',
                        icon_url: 'https://i.imgur.com/9y1uGB0.png',
                    },
                    description: embedded_text,
                }
            }
        }, ( r ) => {
            /* Sanity check. */
            if ( React.MessageController === null ) {
                discordCrypt.log( 'Could not locate the MessageController module!', 'error' );
                return;
            }

            /* Check if an error occurred and inform Clyde bot about it. */
            if ( !r.ok ) {
                /* Perform Clyde dispatch if necessary. */
                if (
                    r.status >= 400 &&
                    r.status < 500 &&
                    r.body &&
                    !React.MessageController.sendClydeError( _channel, r.body.code )
                ) {
                    /* Log the error in case we can't manually dispatch the error. */
                    discordCrypt.log( `Error sending message: ${r.status}`, 'error' );

                    /* Sanity check. */
                    if ( React.MessageDispatcher === null || React.MessageActionTypes === null ) {
                        discordCrypt.log( 'Could not locate the MessageDispatcher module!', 'error' );
                        return;
                    }

                    React.MessageDispatcher.dispatch( {
                        type: React.MessageActionTypes.ActionTypes.MESSAGE_SEND_FAILED,
                        messageId: _nonce,
                        channelId: _channel
                    } );
                }
            }
            else {
                /* Receive the message normally. */
                React.MessageController.receiveMessage( _channel, r.body );
            }
        } );
    }

    /**
     * @public
     * @desc Logs a message to the console in HTML coloring. ( For Electron clients. )
     * @param {string} message The message to log to the console.
     * @param {string} method The indication level of the message.
     *      This can be either ['info', 'warn', 'error', 'success']
     *
     * @example
     * log( 'Hello World!' );
     *
     * @example
     * log( 'This is printed in yellow.', 'warn' );
     *
     * @example
     * log( 'This is printed in red.', 'error' );
     *
     * @example
     * log( 'This is printed green.', 'success' );
     *
     */
    static log( message, method = "info" ) {
        try {
            console[ method ]( `%c[DiscordCrypt]%c - ${message}`, "color: #7f007f; font-weight: bold;", "" );
        }
        catch ( ex ) {
        }
    }

    /**
     * @private
     * @desc Injects a CSS style element into the header tag.
     * @param {string} id The HTML ID string used to identify this CSS style segment.
     * @param {string} css The actual CSS style excluding the <style> tags.
     * @example
     * injectCSS( 'my-css', 'p { font-size: 32px; }' );
     */
    static injectCSS( id, css ) {
        /* Inject into the header tag. */
        $( "head" )
            .append( $( "<style>", { id: id.replace( /^[^a-z]+|[^\w-]+/gi, "" ), html: css } ) )
    }

    /**
     * @private
     * @desc Clears an injected element via its ID tag.
     * @param {string} id The HTML ID string used to identify this CSS style segment.
     * @example
     * clearCSS( 'my-css' );
     */
    static clearCSS( id = undefined ) {
        /* Make sure the ID is a valid string. */
        if ( !id || typeof id !== 'string' || !id.length )
            return;

        /* Remove the element. */
        $( `#${id.replace( /^[^a-z]+|[^\w-]+/gi, "" )}` ).remove();
    }

    /* ================= END PROJECT UTILITIES ================= */

    /* ================= BEGIN MAIN CALLBACKS ================== */

    /**
     * @desc Hooks a dispatcher from Discord's internals.
     * @author samogot & Leonardo Gates
     * @param {object} dispatcher The action dispatcher containing an array of _actionHandlers.
     * @param {string} methodName The name of the method to hook.
     * @param {string} options The type of hook to apply. [ 'before', 'after', 'instead', 'revert' ]
     * @param {boolean} [options.once=false] Set to `true` if you want to automatically unhook method after first call.
     * @param {boolean} [options.silent=false] Set to `true` if you want to suppress log messages about patching and
     *      unhooking. Useful to avoid clogging the console in case of frequent conditional hooking/unhooking, for
     *      example from another monkeyPatch callback.
     * @return {function} Returns the function used to cancel the hook.
     */
    static hookDispatcher( dispatcher, methodName, options ) {
        const { before, after, instead, once = false, silent = false } = options;
        const origMethod = dispatcher._actionHandlers[ methodName ];

        const cancel = () => {
            if ( !silent )
                discordCrypt.log( `Unhooking "${methodName}" ...` );
            dispatcher[ methodName ] = origMethod;
        };

        const suppressErrors = ( method, description ) => ( ... params ) => {
            try {
                return method( ... params );
            }
            catch ( e ) {
                discordCrypt.log( `Error occurred in ${description}`, 'error' )
            }
        };

        if ( !dispatcher._actionHandlers[ methodName ].__hooked ) {
            if ( !silent )
                discordCrypt.log( `Hooking "${methodName}" ...` );

            dispatcher._actionHandlers[ methodName ] = function () {
                /**
                 * @interface
                 * @name PatchData
                 * @property {object} thisObject Original `this` value in current call of patched method.
                 * @property {Arguments} methodArguments Original `arguments` object in current call of patched method.
                 *      Please, never change function signatures, as it may cause a lot of problems in future.
                 * @property {cancelPatch} cancelPatch Function with no arguments and no return value that may be called
                 *      to reverse patching of current method. Calling this function prevents running of this callback
                 *      on further original method calls.
                 * @property {function} originalMethod Reference to the original method that is patched. You can use it
                 *      if you need some special usage. You should explicitly provide a value for `this` and any method
                 *      arguments when you call this function.
                 * @property {function} callOriginalMethod This is a shortcut for calling original method using `this`
                 *      and `arguments` from original call.
                 * @property {*} returnValue This is a value returned from original function call. This property is
                 *      available only in `after` callback or in `instead` callback after calling `callOriginalMethod`
                 *      function.
                 */
                const data = {
                    thisObject: this,
                    methodArguments: arguments,
                    cancelPatch: cancel,
                    originalMethod: origMethod,
                    callOriginalMethod: () => data.returnValue =
                        data.originalMethod.apply( data.thisObject, data.methodArguments )
                };
                if ( instead ) {
                    const tempRet =
                        suppressErrors( instead, `${methodName} called hook via 'instead'.` )( data );

                    if ( tempRet !== undefined )
                        data.returnValue = tempRet;
                }
                else {

                    if ( before )
                        suppressErrors( before, `${methodName} called hook via 'before'.` )( data );

                    data.callOriginalMethod();

                    if ( after )
                        suppressErrors( after, `${methodName} called hook via 'after'.` )( data );
                }
                if ( once )
                    cancel();

                return data.returnValue;
            };

            dispatcher._actionHandlers[ methodName ].__hooked = true;
            dispatcher._actionHandlers[ methodName ].__cancel = cancel;
        }
        return dispatcher._actionHandlers[ methodName ].__cancel;
    }

    hookMessageCallbacks() {

        /* Find the main message dispatcher if not already found. */
        if ( !this.messageDispatcher ) {
            this.messageDispatcher = discordCrypt.getWebpackModuleSearcher().findByDispatchNames( [
                'MESSAGE_CREATE',
                'MESSAGE_UPDATE',
                'MESSAGE_DELETE',
                'LOAD_MESSAGES'
            ] );
        }

        /* Don't proceed if it failed. */
        if ( !this.messageDispatcher ) {
            discordCrypt.log( `Failed to locate the message dispatcher!`, 'error' );
            return;
        }

        discordCrypt.hookDispatcher(
            this.messageDispatcher,
            'MESSAGE_UPDATE',
            {
                after: ( e ) => {
                    if ( e.methodArguments[ 0 ].message.channel_id === discordCrypt.getChannelId() )
                        discordCrypt.log( `${JSON.stringify( e.methodArguments[ 0 ].message )}` );
                }
            }
        );
    }

    unhookMessageCallbacks() {
        if ( !this.messageDispatcher )
            return;

        for ( let prop in this.messageDispatcher._actionHandlers ) {
            if ( prop.hasOwnProperty( '__cancel' ) )
                prop.__cancel();
        }
    }

    /**
     * @private
     * @desc Loads the master-password unlocking prompt.
     */
    loadMasterPassword() {
        const self = this;

        if ( $( '#dc-master-overlay' ).length !== 0 )
            return;

        /* Check if the database exists. */
        const cfg_exists = self.configExists();

        const action_msg = cfg_exists ? 'Unlock Database' : 'Create Database';

        /* Construct the password updating field. */
        $( document.body ).prepend( this.masterPasswordHtml );

        const pwd_field = $( '#dc-db-password' );
        const cancel_btn = $( '#dc-cancel-btn' );
        const unlock_btn = $( '#dc-unlock-database-btn' );
        const master_status = $( '#dc-master-status' );
        const master_header_message = $( '#dc-header-master-msg' );
        const master_prompt_message = $( '#dc-prompt-master-msg' );

        /* Use these messages based on whether we're creating a database or unlocking it. */
        master_header_message.text(
            cfg_exists ?
                '---------- Database Is Locked ----------' :
                '---------- Database Not Found ----------'
        );
        master_prompt_message.text(
            cfg_exists ?
                'Enter Password:' :
                'Enter New Password:'
        );
        unlock_btn.text( action_msg );

        /* Force the database element to load. */
        document.getElementById( 'dc-master-overlay' ).style.display = 'block';

        /* Check for ENTER key press to execute unlocks. */
        pwd_field.on( "keydown", ( function ( e ) {
            let code = e.keyCode || e.which;

            /* Execute on ENTER/RETURN only. */
            if ( code !== 13 )
                return;

            unlock_btn.click();
        } ) );

        /* Handle unlock button clicks. */
        unlock_btn.click( ( function () {

            /* Disable the button before clicking. */
            unlock_btn.attr( 'disabled', true );

            /* Update the text. */
            if ( cfg_exists )
                unlock_btn.text( 'Unlocking Database ...' );
            else
                unlock_btn.text( 'Creating Database ...' );

            /* Get the password entered. */
            let password = pwd_field[ 0 ].value;

            /* Validate the field entered contains some value. */
            if ( password === null || password === '' ) {
                unlock_btn.text( action_msg );
                unlock_btn.attr( 'disabled', false );
                return;
            }

            /* Hash the password. */
            discordCrypt.scrypt
            (
                Buffer.from( password ),
                Buffer.from( discordCrypt.whirlpool( password, true ), 'hex' ),
                32,
                4096,
                8,
                1,
                ( error, progress, pwd ) => {
                    if ( error ) {
                        /* Update the button's text. */
                        if ( cfg_exists )
                            unlock_btn.text( 'Invalid Password!' );
                        else
                            unlock_btn.text( `Error: ${error}` );

                        /* Clear the text field. */
                        pwd_field[ 0 ].value = '';

                        /* Reset the progress bar. */
                        master_status.css( 'width', '0%' );

                        /* Reset the text of the button after 1 second. */
                        setTimeout( ( function () {
                            unlock_btn.text( action_msg );
                        } ), 1000 );

                        discordCrypt.log( error.toString(), 'error' );
                        return true;
                    }

                    if ( progress )
                        master_status.css( 'width', `${parseInt( progress * 100 )}%` );

                    if ( pwd ) {
                        /* To test whether this is the correct password or not, we have to attempt to use it. */
                        self.masterPassword = Buffer.from( pwd, 'hex' );

                        /* Attempt to load the database with this password. */
                        if ( !self.loadConfig() ) {
                            self.configFile = null;

                            /* Update the button's text. */
                            if ( cfg_exists )
                                unlock_btn.text( 'Invalid Password!' );
                            else
                                unlock_btn.text( 'Failed to create the database!' );

                            /* Clear the text field. */
                            pwd_field[ 0 ].value = '';

                            /* Reset the progress bar. */
                            master_status.css( 'width', '0%' );

                            /* Reset the text of the button after 1 second. */
                            setTimeout( ( function () {
                                unlock_btn.text( action_msg );
                            } ), 1000 );

                            /* Proceed no further. */
                            unlock_btn.attr( 'disabled', false );
                            return false;
                        }

                        /* We may now call the start() function. */
                        self.start();

                        /* And update the button text. */
                        if ( cfg_exists )
                            unlock_btn.text( 'Unlocked Successfully!' );
                        else
                            unlock_btn.text( 'Created Successfully!' );

                        /* Close the overlay after 1 second. */
                        setTimeout( ( function () {
                            $( '#dc-master-overlay' ).remove();
                        } ), 1000 );
                    }

                    return false;
                }
            );
        } ) );

        /* Handle cancel button presses. */
        cancel_btn.click( ( function () {
            /* Use a 300 millisecond delay. */
            setTimeout(
                ( function () {
                    /* Remove the prompt overlay. */
                    $( '#dc-master-overlay' ).remove();

                    /* Do some quick cleanup. */
                    self.masterPassword = null;
                    self.configFile = null;
                } ), 300
            );
        } ) );
    }

    /**
     * @private
     * @desc Performs an async update checking and handles actually updating the current version if necessary.
     */
    checkForUpdates() {
        const self = this;

        setTimeout( () => {
            /* Proxy call. */
            try {
                discordCrypt.checkForUpdate( ( file_data, short_hash, new_version, full_changelog ) => {
                    const replacePath = require( 'path' )
                        .join( discordCrypt.getPluginsPath(), discordCrypt.getPluginName() );
                    const fs = require( 'fs' );

                    /* Alert the user of the update and changelog. */
                    $( '#dc-overlay' )[ 0 ].style.display = 'block';
                    $( '#dc-update-overlay' )[ 0 ].style.display = 'block';

                    /* Update the version info. */
                    $( '#dc-new-version' )
                        .text( `New Version: ${new_version === '' ? 'N/A' : new_version} ( #${short_hash} )` );
                    $( '#dc-old-version' ).text( `Old Version: ${self.getVersion()}` );

                    /* Update the changelog. */
                    let dc_changelog = $( '#dc-changelog' );
                    dc_changelog.val(
                        typeof full_changelog === "string" && full_changelog.length > 0 ?
                            full_changelog :
                            'N/A'
                    );

                    /* Scroll to the top of the changelog. */
                    dc_changelog.scrollTop( 0 );

                    /* Replace the file. */
                    fs.writeFile( replacePath, file_data, ( err ) => {
                        if ( err ) {
                            discordCrypt.log(
                                `Unable to replace the target plugin. ( ${err} )\nDestination: ${replacePath}`, 'error'
                            );
                            _alert( 'Failed to apply the update!', 'Error During Update' );
                        }
                    } );
                } );
            }
            catch ( ex ) {
                discordCrypt.log( ex, 'warn' );
            }
        }, 1000 );
    }

    /**
     * @private
     * @desc Sets the active tab index in the exchange key menu.
     * @param {int} index The index ( 0-2 ) of the page to activate.
     * @example
     * setActiveTab( 1 );
     */
    static setActiveTab( index ) {
        let tab_names = [ 'dc-about-tab', 'dc-keygen-tab', 'dc-handshake-tab' ];
        let tabs = $( '.dc-tab-link' );

        /* Hide all tabs. */
        for ( let i = 0; i < tab_names.length; i++ )
            $( `#${tab_names[ i ]}` )[ 0 ].style.display = 'none';

        /* Deactivate all links. */
        for ( let i = 0; i < tabs.length; i++ )
            tabs[ i ].className = tabs[ i ].className.split( ' active' ).join( '' );

        switch ( index ) {
            case 0:
                $( '#dc-tab-info-btn' )[ 0 ].className += ' active';
                $( '#dc-about-tab' )[ 0 ].style.display = 'block';
                break;
            case 1:
                $( '#dc-tab-keygen-btn' )[ 0 ].className += ' active';
                $( '#dc-keygen-tab' )[ 0 ].style.display = 'block';
                break;
            case 2:
                $( '#dc-tab-handshake-btn' )[ 0 ].className += ' active';
                $( '#dc-handshake-tab' )[ 0 ].style.display = 'block';
                break;
            default:
                break;
        }
    }

    /**
     * @private
     * @desc Inserts the plugin's option toolbar to the current toolbar and handles all triggers.
     */
    loadToolbar() {
        /* Skip if the configuration hasn't been loaded. */
        if ( !this.configFile )
            return;

        /* Skip if we're not in an active channel. */
        if ( discordCrypt.getChannelId() === '@me' )
            return;

        /* Toolbar buttons and their icons if it doesn't exist. */
        if ( $( '#dc-passwd-btn' ).length !== 0 )
            return;

        /* Inject the toolbar. */
        $( this.searchUiClass ).parent().parent().parent().prepend( this.toolbarHtml );

        /* Set the SVG button class. */
        $( '.dc-svg' ).attr( 'class', 'dc-svg' );

        /* Set the initial status icon. */
        if ( $( '#dc-lock-btn' ).length > 0 ) {
            if ( this.configFile.encodeAll ) {
                $( '#dc-lock-btn' ).attr( 'title', 'Disable Message Encryption' );
                $( '#dc-lock-btn' )[ 0 ].innerHTML = Buffer.from( this.lockIcon, 'base64' ).toString( 'utf8' );
            }
            else {
                $( '#dc-lock-btn' ).attr( 'title', 'Enable Message Encryption' );
                $( '#dc-lock-btn' )[ 0 ].innerHTML = Buffer.from( this.unlockIcon, 'base64' ).toString( 'utf8' );
            }

            /* Set the button class. */
            $( '.dc-svg' ).attr( 'class', 'dc-svg' );
        }

        /* Inject the settings. */
        $( document.body ).prepend( this.settingsMenuHtml );

        /* Also by default, set the about tab to be shown. */
        discordCrypt.setActiveTab( 0 );

        /* Update all settings from the settings panel. */
        $( '#dc-settings-encrypt-trigger' )[ 0 ].value = this.configFile.encodeMessageTrigger;
        $( '#dc-settings-default-pwd' )[ 0 ].value = this.configFile.defaultPassword;
        $( '#dc-settings-scan-delay' )[ 0 ].value = this.configFile.encryptScanDelay;
        $( '#dc-settings-padding-mode' )[ 0 ].value = this.configFile.paddingMode.toLowerCase();
        $( '#dc-settings-cipher-mode' )[ 0 ].value = this.configFile.encryptBlockMode.toLowerCase();
        $( '#dc-primary-cipher' )[ 0 ].value = discordCrypt.cipherIndexToString( this.configFile.encryptMode, false );
        $( '#dc-secondary-cipher' )[ 0 ].value = discordCrypt.cipherIndexToString( this.configFile.encryptMode, true );

        /* Handle clipboard upload button. */
        $( '#dc-clipboard-upload-btn' ).click( discordCrypt.on_upload_encrypted_clipboard_button_clicked( this ) );

        /* Handle file button clicked. */
        $( '#dc-file-btn' ).click( discordCrypt.on_file_button_clicked );

        /* Handle alter file path button. */
        $( '#dc-select-file-path-btn' ).click( discordCrypt.on_alter_file_button_clicked );

        /* Handle file upload button. */
        $( '#dc-file-upload-btn' ).click( discordCrypt.on_upload_file_button_clicked( this ) );

        /* Handle file button cancelled. */
        $( '#dc-file-cancel-btn' ).click( discordCrypt.on_cancel_file_upload_button_clicked );

        /* Handle Settings tab opening. */
        $( '#dc-settings-btn' ).click( discordCrypt.on_settings_button_clicked );

        /* Handle Settings tab closing. */
        $( '#dc-exit-settings-btn' ).click( discordCrypt.on_settings_close_button_clicked );

        /* Handle Save settings. */
        $( '#dc-settings-save-btn' ).click( discordCrypt.on_save_settings_button_clicked( this ) );

        /* Handle Reset settings. */
        $( '#dc-settings-reset-btn' ).click( discordCrypt.on_reset_settings_button_clicked( this ) );

        /* Handle Restart-Now button clicking. */
        $( '#dc-restart-now-btn' ).click( discordCrypt.on_restart_now_button_clicked );

        /* Handle Restart-Later button clicking. */
        $( '#dc-restart-later-btn' ).click( discordCrypt.on_restart_later_button_clicked );

        /* Handle Info tab switch. */
        $( '#dc-tab-info-btn' ).click( discordCrypt.on_info_tab_button_clicked );

        /* Handle Keygen tab switch. */
        $( '#dc-tab-keygen-btn' ).click( discordCrypt.on_exchange_tab_button_clicked );

        /* Handle Handshake tab switch. */
        $( '#dc-tab-handshake-btn' ).click( discordCrypt.on_handshake_tab_button_clicked );

        /* Handle exit tab button. */
        $( '#dc-exit-exchange-btn' ).click( discordCrypt.on_close_exchange_button_clicked );

        /* Open exchange menu. */
        $( '#dc-exchange-btn' ).click( discordCrypt.on_open_exchange_button_clicked );

        /* Quickly generate and send a public key. */
        $( '#dc-quick-exchange-btn' ).click( discordCrypt.on_quick_send_public_key_button_clicked );

        /* Repopulate the bit length options for the generator when switching handshake algorithms. */
        $( '#dc-keygen-method' ).change( discordCrypt.on_exchange_algorithm_changed );

        /* Generate a new key-pair on clicking. */
        $( '#dc-keygen-gen-btn' ).click( discordCrypt.on_generate_new_key_pair_button_clicked );

        /* Clear the public & private key fields. */
        $( '#dc-keygen-clear-btn' ).click( discordCrypt.on_keygen_clear_button_clicked );

        /* Send the public key to the current channel. */
        $( '#dc-keygen-send-pub-btn' ).click( discordCrypt.on_keygen_send_public_key_button_clicked( this ) );

        /* Paste the data from the clipboard to the public key field. */
        $( '#dc-handshake-paste-btn' ).click( discordCrypt.on_handshake_paste_public_key_button_clicked );

        /* Compute the primary and secondary keys. */
        $( '#dc-handshake-compute-btn' ).click( discordCrypt.on_handshake_compute_button_clicked( this ) );

        /* Copy the primary and secondary key to the clipboard. */
        $( '#dc-handshake-cpy-keys-btn' ).click( discordCrypt.on_handshake_copy_keys_button_clicked );

        /* Apply generated keys to the current channel. */
        $( '#dc-handshake-apply-keys-btn' ).click( discordCrypt.on_handshake_apply_keys_button_clicked( this ) );

        /* Show the overlay when clicking the password button. */
        $( '#dc-passwd-btn' ).click( discordCrypt.on_passwd_button_clicked );

        /* Update the password for the user once clicked. */
        $( '#dc-save-pwd' ).click( discordCrypt.on_save_passwords_button_clicked( this ) );

        /* Reset the password for the user to the default. */
        $( '#dc-reset-pwd' ).click( discordCrypt.on_reset_passwords_button_clicked( this ) );

        /* Hide the overlay when clicking cancel. */
        $( '#dc-cancel-btn' ).click( discordCrypt.on_cancel_password_button_clicked );

        /* Copy the current passwords to the clipboard. */
        $( '#dc-cpy-pwds-btn' ).click( discordCrypt.on_copy_current_passwords_button_clicked( this ) );

        /* Set whether auto-encryption is enabled or disabled. */
        $( '#dc-lock-btn' ).click( discordCrypt.on_lock_button_clicked( this ) );
    }

    /**
     * @private
     * @desc Attached a handler to the message area and dispatches encrypted messages if necessary.
     */
    attachHandler() {
        const self = this;

        /* Get the text area. */
        let textarea = $( this.channelTextAreaClass );

        /* Make sure we got one element. */
        if ( textarea.length !== 1 )
            return;

        /* Replace any old handlers before adding the new one. */
        textarea.off( "keydown.dcrypt" ).on( "keydown.dcrypt", ( function ( e ) {
            let code = e.keyCode || e.which;

            /* Skip if we don't have a valid configuration. */
            if ( !self.configFile )
                return;

            /* Execute on ENTER/RETURN only. */
            if ( code !== 13 )
                return;

            /* Skip if shift key is down indicating going to a new line. */
            if ( e.shiftKey )
                return;

            /* Skip if autocomplete dialog is opened. */
            if ( !!$( self.autoCompleteClass )[ 0 ] )
                return;

            /* Send the encrypted message. */
            if ( self.sendEncryptedMessage( $( this ).val() ) != 0 )
                return;

            /* Clear text field. */
            discordCrypt.__getElementReactOwner( $( 'form' )[ 0 ] ).setState( { textValue: '' } );

            /* Cancel the default sending action. */
            e.preventDefault();
            e.stopPropagation();
        } ) );
    }

    /**
     * @private
     * @desc Parses a public key message and adds the exchange button to it if necessary.
     * @param {Object} obj The jQuery object of the current message being examined.
     * @returns {boolean} Returns true.
     */
    parseKeyMessage( obj ) {
        /* Extract the algorithm info from the message's metadata. */
        let metadata = discordCrypt.__extractKeyInfo( obj.text().replace( /\r?\n|\r/g, '' ), true );

        /* Compute the fingerprint of our currently known public key if any to determine if to proceed. */
        let local_fingerprint = discordCrypt.sha256( Buffer.from( $( '#dc-pub-key-ta' ).val(), 'hex' ), 'hex' );

        /* Skip if this is our current public key. */
        if ( metadata[ 'fingerprint' ] === local_fingerprint ) {
            obj.css( 'display', 'none' );
            return true;
        }

        /* Create a button allowing the user to perform a key exchange with this public key. */
        let button = $( "<button>Perform Key Exchange</button>" )
            .addClass( 'dc-button' )
            .addClass( 'dc-button-inverse' );

        /* Remove margins. */
        button.css( 'margin-left', '0' );
        button.css( 'margin-right', '0' );

        /* Move the button a bit down from the key's text. */
        button.css( 'margin-top', '2%' );

        /* Allow full width. */
        button.css( 'width', '100%' );

        /* Handle clicks. */
        button.click( ( function () {

            /* Simulate pressing the exchange key button. */
            $( '#dc-exchange-btn' ).click();

            /* If the current algorithm differs, change it and generate then send a new key. */
            if (
                $( '#dc-keygen-method' )[ 0 ].value !== metadata[ 'algorithm' ] ||
                parseInt( $( '#dc-keygen-algorithm' )[ 0 ].value ) !== metadata[ 'bit_length' ]
            ) {
                /* Switch. */
                $( '#dc-keygen-method' )[ 0 ].value = metadata[ 'algorithm' ];

                /* Fire the change event so the second list updates. */
                $( '#dc-keygen-method' ).change();

                /* Update the key size. */
                $( '#dc-keygen-algorithm' )[ 0 ].value = metadata[ 'bit_length' ];

                /* Generate a new key pair. */
                $( '#dc-keygen-gen-btn' ).click();

                /* Send the public key. */
                $( '#dc-keygen-send-pub-btn' ).click();
            }
            /* If we don't have a key yet, generate and send one. */
            else if ( $( '#dc-pub-key-ta' )[ 0 ].value === '' ) {
                /* Generate a new key pair. */
                $( '#dc-keygen-gen-btn' ).click();

                /* Send the public key. */
                $( '#dc-keygen-send-pub-btn' ).click();
            }

            /* Open the handshake menu. */
            $( '#dc-tab-handshake-btn' ).click();

            /* Apply the key to the field. */
            $( '#dc-handshake-ppk' )[ 0 ].value = obj.text();

            /* Click compute. */
            $( '#dc-handshake-compute-btn' ).click();
        } ) );

        /* Add the button. */
        obj.parent().append( button );

        /* Set the text to an identifiable color. */
        obj.css( 'color', 'blue' );

        return true;
    }

    /**
     * @private
     * @desc Parses a message object and attempts to decrypt it..
     * @param {Object} obj The jQuery object of the current message being examined.
     * @param {string} primaryKey The primary key used to decrypt the message.
     * @param {string} secondaryKey The secondary key used to decrypt the message.
     * @param {Object} ReactModules The modules retrieved by calling getReactModules()
     * @returns {boolean} Returns true if the message has been decrypted.
     */
    parseSymmetric( obj, primaryKey, secondaryKey, ReactModules ) {
        let message = $( obj );
        let dataMsg;

        /**************************************************************************************************************
         *  MESSAGE FORMAT:
         *
         *  + 0x0000 [ 4        Chars ] - Message Magic | Key Magic
         *  + 0x0004 [ 8 ( #4 ) Chars ] - Message Metadata ( #1 ) | Key Data ( #3 )
         *  + 0x000C [ ?        Chars ] - Cipher Text
         *
         *  * 0x0004 - Options - Substituted Base64 encoding of a single word stored in Little Endian.
         *      [ 31 ... 24 ] - Algorithm ( 0-24 = Dual )
         *      [ 23 ... 16 ] - Block Mode ( 0 = CBC | 1 = CFB | 2 = OFB )
         *      [ 15 ... 08 ] - Padding Mode ( #2 )
         *      [ 07 ... 00 ] - Random Padding Byte
         *
         *  #1 - Substitute( Base64( Encryption Algorithm << 24 | Padding Mode << 16 | Block Mode << 8 | RandomByte ) )
         *  #2 - ( 0 - PKCS #7 | 1 = ANSI X9.23 | 2 = ISO 10126 | 3 = ISO97971 )
         *  #3 - Substitute( Base64( ( Key Algorithm Type & 0xff ) + Public Key ) )
         *  #4 - 8 Byte Metadata For Messages Only
         *
         **************************************************************************************************************/

        /* Skip if the message is <= size of the total header. */
        if ( message.text().length <= 12 )
            return false;

        /* Split off the magic. */
        let magic = message.text().slice( 0, 4 );

        /* If this is a public key, just add a button and continue. */
        if ( magic === this.encodedKeyHeader )
            return this.parseKeyMessage( message );

        /* Make sure it has the correct header. */
        if ( magic !== this.encodedMessageHeader )
            return false;

        /* Try to deserialize the metadata. */
        let metadata = discordCrypt.metaDataDecode( message.text().slice( 4, 12 ) );

        /* Try looking for an algorithm, mode and padding type. */
        /* Algorithm first. */
        if ( metadata[ 0 ] >= this.encryptModes.length )
            return false;

        /* Cipher mode next. */
        if ( metadata[ 1 ] >= this.encryptBlockModes.length )
            return false;

        /* Padding after. */
        if ( metadata[ 2 ] >= this.paddingModes.length )
            return false;

        /* Decrypt the message. */
        dataMsg = discordCrypt.symmetricDecrypt( message.text().replace( /\r?\n|\r/g, '' )
            .substr( 12 ), primaryKey, secondaryKey, metadata[ 0 ], metadata[ 1 ], metadata[ 2 ], true );

        /* If decryption didn't fail, set the decoded text along with a green foreground. */
        if ( ( typeof dataMsg === 'string' || dataMsg instanceof String ) && dataMsg !== "" ) {
            /* Expand the message to the maximum width. */
            message.parent().parent().parent().parent().css( 'max-width', '100%' );

            /* Process the message and apply all necessary element modifications. */
            dataMsg = discordCrypt.postProcessMessage( dataMsg, this.configFile.up1Host );

            /* Set the new HTML. */
            message[ 0 ].innerHTML = dataMsg.html;

            /* If this contains code blocks, highlight them. */
            if ( dataMsg.code ) {
                /* Sanity check. */
                if ( ReactModules.HighlightJS !== null ) {

                    /* The inner element contains a <span></span> class, get all children beneath that. */
                    let elements = $( message.children()[ 0 ] ).children();

                    /* Loop over each element to get the markup division list. */
                    for ( let i = 0; i < elements.length; i++ ) {
                        /* Highlight the element's <pre><code></code></code> block. */
                        ReactModules.HighlightJS.highlightBlock( $( elements[ i ] ).children()[ 0 ] );

                        /* Reset the class name. */
                        $( elements[ i ] ).children()[ 0 ].className = 'hljs';
                    }
                }
                else
                    discordCrypt.log( 'Could not locate HighlightJS module!', 'error' );
            }

            /* Decrypted messages get set to green. */
            message.css( 'color', 'green' );
        }
        else {
            /* If it failed, set a red foreground and set a decryption failure message to prevent further retries. */
            if ( dataMsg === 1 )
                message.text( '[ ERROR ] AUTHENTICATION OF CIPHER TEXT FAILED !!!' );
            else if ( dataMsg === 2 )
                message.text( '[ ERROR ] FAILED TO DECRYPT CIPHER TEXT !!!' );
            else
                message.text( '[ ERROR ] DECRYPTION FAILURE. INVALID KEY OR MALFORMED MESSAGE !!!' );
            message.css( 'color', 'red' );
        }

        /* Message has been parsed. */
        return true;
    }

    /**
     * @private
     * @desc Processes a decrypted message and formats any elements needed in HTML.
     * @param message The message to process.
     * @param {string} [embed_link_prefix] Optional search link prefix for URLs to embed in frames.
     * @returns {{url: boolean, code: boolean, html: (string|*)}}
     */
    static postProcessMessage( message, embed_link_prefix ) {
        /* HTML escape characters. */
        const html_escape_characters = { '&': '&amp;', '<': '&lt', '>': '&gt;' };

        /* Remove any injected HTML. */
        message = message.replace( /[&<>]/g, x => html_escape_characters[ x ] );

        /* Extract any code blocks from the message. */
        let processed = discordCrypt.__buildCodeBlockMessage( message );
        let hasCode = processed.code;

        /* Extract any URLs. */
        processed = discordCrypt.__buildUrlMessage( processed.html, embed_link_prefix );
        let hasUrl = processed.url;

        /* Return the raw HTML. */
        return {
            url: hasUrl,
            code: hasCode,
            html: processed.html,
        };
    }

    /**
     * @private
     * @desc Iterates all messages in the current channel and tries to decrypt each, skipping cached results.
     */
    decodeMessages() {
        /* Skip if a valid configuration file has not been loaded. */
        if ( !this.configFile || !this.configFile.version )
            return;

        /* Save self. */
        const self = this;

        /* Get the current channel ID. */
        let id = discordCrypt.getChannelId();

        /* Use the default password for decryption if one hasn't been defined for this channel. */
        let password = Buffer.from(
            this.configFile.passList[ id ] && this.configFile.passList[ id ].primary ?
                this.configFile.passList[ id ].primary :
                this.configFile.defaultPassword
        );
        let secondary = Buffer.from(
            this.configFile.passList[ id ] && this.configFile.passList[ id ].secondary ?
                this.configFile.passList[ id ].secondary :
                this.configFile.defaultPassword
        );

        /* Look through each markup element to find an embedDescription. */
        let React = discordCrypt.getReactModules();
        $( this.messageMarkupClass ).each( ( function () {
            /* Skip classes with no embeds. */
            if ( !this.className.includes( 'embedDescription' ) )
                return;

            /* Skip parsed messages. */
            if ( $( this ).data( 'dc-parsed' ) !== undefined )
                return;

            /* Try parsing a symmetric message. */
            self.parseSymmetric( this, password, secondary, React );

            /* Set the flag. */
            $( this ).data( 'dc-parsed', true );
        } ) );
    }

    /**
     * @private
     * @desc Sends an encrypted message to the current channel.
     * @param {string} message The unencrypted message to send.
     * @param {boolean} force_send Whether to ignore checking for the encryption trigger and always encrypt and send.
     * @returns {number} Returns 1 if the message failed to be parsed correctly and 0 on success.
     * @param {int|undefined} channel_id If specified, sends the embedded message to this channel instead of the
     *      current channel.
     */
    sendEncryptedMessage( message, force_send = false, channel_id = undefined ) {
        /* Let's use a maximum message size of 1200 instead of 2000 to account for encoding, new line feeds & packet
         header. */
        const maximum_encoded_data = 1200;

        /* Add the message signal handler. */
        const escapeCharacters = [ "#", "/", ":" ];
        const crypto = require( 'crypto' );

        let cleaned;

        /* Skip messages starting with pre-defined escape characters. */
        if ( escapeCharacters.indexOf( message[ 0 ] ) !== -1 )
            return 1;

        /* If we're not encoding all messages or we don't have a password, strip off the magic string. */
        if ( force_send === false &&
            ( !this.configFile.passList[ discordCrypt.getChannelId() ] ||
                !this.configFile.passList[ discordCrypt.getChannelId() ].primary ||
                !this.configFile.encodeAll )
        ) {
            /* Try splitting via the defined split-arg. */
            message = message.split( '|' );

            /* Check if the message actually has the split arg. */
            if ( message.length <= 0 )
                return 1;

            /* Check if it has the trigger. */
            if ( message[ message.length - 1 ] !== this.configFile.encodeMessageTrigger )
                return 1;

            /* Use the first part of the message. */
            cleaned = message[ 0 ];
        }
        /* Make sure we have a valid password. */
        else {
            /* Use the whole message. */
            cleaned = message;
        }

        /* Check if we actually have a message ... */
        if ( cleaned.length === 0 )
            return 1;

        /* Try parsing any user-tags. */
        let parsed = discordCrypt.__extractTags( cleaned );

        /* Sanity check for messages with just spaces or new line feeds in it. */
        if ( parsed[ 0 ].length !== 0 ) {
            /* Extract the message to be encrypted. */
            cleaned = parsed[ 0 ];
        }

        /* Add content tags. */
        let user_tags = parsed[ 1 ].length > 0 ? parsed[ 1 ] : '';

        /* Get the passwords. */
        let primaryPassword = Buffer.from(
            this.configFile.passList[ discordCrypt.getChannelId() ] ?
                this.configFile.passList[ discordCrypt.getChannelId() ].primary :
                this.configFile.defaultPassword
        );

        let secondaryPassword = Buffer.from(
            this.configFile.passList[ discordCrypt.getChannelId() ] ?
                this.configFile.passList[ discordCrypt.getChannelId() ].secondary :
                this.configFile.defaultPassword
        );

        /* Returns the number of bytes a given string is in Base64. */
        function getBase64EncodedLength( len ) {
            return parseInt( ( len / 3 ) * 4 ) % 4 === 0 ? ( len / 3 ) * 4 :
                parseInt( ( len / 3 ) * 4 ) + 4 - ( parseInt( ( len / 3 ) * 4 ) % 4 );
        }

        /* If the message length is less than the threshold, we can send it without splitting. */
        if ( getBase64EncodedLength( cleaned.length ) < maximum_encoded_data ) {
            /* Encrypt the message. */
            let msg = discordCrypt.symmetricEncrypt(
                cleaned,
                primaryPassword,
                secondaryPassword,
                this.configFile.encryptMode,
                this.configFile.encryptBlockMode,
                this.configFile.paddingMode,
                true
            );

            /* Append the header to the message normally. */
            msg = this.encodedMessageHeader + discordCrypt.metaDataEncode
            (
                this.configFile.encryptMode,
                this.configFile.encryptBlockMode,
                this.configFile.paddingMode,
                parseInt( crypto.randomBytes( 1 )[ 0 ] )
            ) + msg;

            /* Break up the message into lines. */
            msg = msg.replace( /(.{32})/g, ( e ) => {
                return `${e}\r\n`
            } );

            /* Send the message. */
            discordCrypt.sendEmbeddedMessage(
                msg,
                this.messageHeader,
                `v${this.getVersion().replace( '-debug', '' )}`,
                0x551A8B,
                user_tags,
                channel_id
            );
        }
        else {
            /* Determine how many packets we need to split this into. */
            let packets = discordCrypt.__splitStringChunks( cleaned, maximum_encoded_data );
            for ( let i = 0; i < packets.length; i++ ) {
                /* Encrypt the message. */
                let msg = discordCrypt.symmetricEncrypt(
                    packets[ i ],
                    primaryPassword,
                    secondaryPassword,
                    this.configFile.encryptMode,
                    this.configFile.encryptBlockMode,
                    this.configFile.paddingMode,
                    true
                );

                /* Append the header to the message normally. */
                msg = this.encodedMessageHeader + discordCrypt.metaDataEncode
                (
                    this.configFile.encryptMode,
                    this.configFile.encryptBlockMode,
                    this.configFile.paddingMode,
                    parseInt( crypto.randomBytes( 1 )[ 0 ] )
                ) + msg;

                /* Break up the message into lines. */
                msg = msg.replace( /(.{32})/g, ( e ) => {
                    return `${e}\r\n`
                } );

                /* Send the message. */
                discordCrypt.sendEmbeddedMessage(
                    msg,
                    this.messageHeader,
                    `v${this.getVersion().replace( '-debug', '' )}`,
                    0x551A8B,
                    i === 0 ? user_tags : '',
                    channel_id
                );
            }
        }

        return 0;
    }

    /* =============== BEGIN UI HANDLE CALLBACKS =============== */

    /**
     * @private
     * @desc Opens the file uploading menu.
     */
    static on_file_button_clicked() {
        /* Show main background. */
        $( '#dc-overlay' )[ 0 ].style.display = 'block';

        /* Show the upload overlay. */
        $( '#dc-overlay-upload' )[ 0 ].style.display = 'block';
    }

    /**
     * @private
     * @desc Opens the file menu selection.
     */
    static on_alter_file_button_clicked() {
        /* Create an input element. */
        let file = require( 'electron' ).remote.dialog.showOpenDialog( {
            title: 'Select a file to encrypt and upload',
            label: 'Select',
            message: 'Maximum file size is 50 MB',
            properties: [ 'openFile', 'showHiddenFiles', 'treatPackageAsDirectory' ]
        } );

        /* Ignore if no file was selected. */
        if ( !file.length || !file[ 0 ].length )
            return;

        /* Set the file path to the selected path. */
        $( '#dc-file-path' ).val( file[ 0 ] );
    }

    /**
     * @private
     * @desc Uploads the clipboard's current contents and sends the encrypted link.
     * @param {discordCrypt} self
     * @returns {Function}
     */
    static on_upload_encrypted_clipboard_button_clicked( /* discordCrypt */ self ) {
        return () => {
            /* Since this is an async operation, we need to backup the channel ID before doing this. */
            let channel_id = discordCrypt.getChannelId();

            /* Upload the clipboard. */
            discordCrypt.__up1UploadClipboard(
                self.configFile.up1Host,
                self.configFile.up1ApiKey,
                sjcl,
                ( error_string, file_url, deletion_link ) => {
                    /* Do some sanity checking. */
                    if ( error_string !== null || typeof file_url !== 'string' || typeof deletion_link !== 'string' ) {
                        _alert( error_string, 'Failed to upload the clipboard!' );
                        return;
                    }

                    /* Format and send the message. */
                    self.sendEncryptedMessage( `${file_url}`, true, channel_id );

                    /* Copy the deletion link to the clipboard. */
                    require( 'electron' ).clipboard.writeText( `Delete URL: ${deletion_link}` );
                }
            );
        };
    }

    /**
     * @private
     * @desc  Uploads the selected file and sends the encrypted link.
     * @param {discordCrypt} self
     * @returns {Function}
     */
    static on_upload_file_button_clicked( /* discordCrypt */ self ) {
        return () => {
            const fs = require( 'original-fs' );

            let file_path_field = $( '#dc-file-path' );
            let file_upload_btn = $( '#dc-file-upload-btn' );
            let message_textarea = $( '#dc-file-message-textarea' );
            let send_deletion_link = $( '#dc-file-deletion-checkbox' ).is( ':checked' );
            let randomize_file_name = $( '#dc-file-name-random-checkbox' ).is( ':checked' );

            /* Send the additional text first if it's valid. */
            if ( message_textarea.val().length > 0 )
                self.sendEncryptedMessage( message_textarea.val(), true );

            /* Since this is an async operation, we need to backup the channel ID before doing this. */
            let channel_id = discordCrypt.getChannelId();

            /* Clear the message field. */
            message_textarea.val( '' );

            /* Sanity check the file. */
            if ( !fs.existsSync( file_path_field.val() ) ) {
                file_path_field.val( '' );
                return;
            }

            /* Set the status text. */
            file_upload_btn.text( 'Uploading ...' );
            file_upload_btn[ 0 ].className = 'dc-button dc-button-inverse';

            /* Upload the file. */
            discordCrypt.__up1UploadFile(
                file_path_field.val(),
                self.configFile.up1Host,
                self.configFile.up1ApiKey,
                sjcl,
                ( error_string, file_url, deletion_link ) => {
                    /* Do some sanity checking. */
                    if ( error_string !== null || typeof file_url !== 'string' || typeof deletion_link !== 'string' ) {
                        /* Set the status text. */
                        file_upload_btn.text( 'Failed to upload the file!' );
                        discordCrypt.log( error_string, 'error' );

                        /* Clear the file path. */
                        file_path_field.val( '' );

                        /* Reset the status text after 1 second. */
                        setTimeout( () => {
                            file_upload_btn.text( 'Upload' );
                            file_upload_btn[ 0 ].className = 'dc-button';
                        }, 1000 );

                        return;
                    }

                    /* Format and send the message. */
                    self.sendEncryptedMessage(
                        `${file_url}${send_deletion_link ? '\n\nDelete URL: ' + deletion_link : ''}`,
                        true,
                        channel_id
                    );

                    /* Clear the file path. */
                    file_path_field.val( '' );

                    /* Indicate success. */
                    file_upload_btn.text( 'Upload Successful!' );

                    /* Reset the status text after 1 second and close the dialog. */
                    setTimeout( () => {
                        file_upload_btn.text( 'Upload' );
                        file_upload_btn[ 0 ].className = 'dc-button';

                        /* Close. */
                        $( '#dc-file-cancel-btn' ).click();
                    }, 1000 );
                },
                randomize_file_name
            );
        };
    }

    /**
     * @private
     * @desc Closes the file upload dialog.
     */
    static on_cancel_file_upload_button_clicked() {
        /* Clear old file name. */
        $( '#dc-file-path' ).val( '' );

        /* Show main background. */
        $( '#dc-overlay' )[ 0 ].style.display = 'none';

        /* Show the upload overlay. */
        $( '#dc-overlay-upload' )[ 0 ].style.display = 'none';
    }

    /**
     * @private
     * @desc Opens the settings menu.
     */
    static on_settings_button_clicked() {
        /* Show main background. */
        $( '#dc-overlay' )[ 0 ].style.display = 'block';

        /* Show the main settings menu. */
        $( '#dc-overlay-settings' )[ 0 ].style.display = 'block';
    }

    /**
     * @private
     * @desc Closes the settings menu.
     */
    static on_settings_close_button_clicked() {
        /* Hide main background. */
        $( '#dc-overlay' )[ 0 ].style.display = 'none';

        /* Hide the main settings menu. */
        $( '#dc-overlay-settings' )[ 0 ].style.display = 'none';
    }

    /**
     * @private
     * @desc Saves all settings.
     * @param {discordCrypt} self
     * @returns {Function}
     */
    static on_save_settings_button_clicked( /* discordCrypt */ self ) {
        return () => {
            /* Update all settings from the settings panel. */
            self.configFile.encodeMessageTrigger = $( '#dc-settings-encrypt-trigger' )[ 0 ].value;
            self.configFile.encryptBlockMode = $( '#dc-settings-cipher-mode' )[ 0 ].value;
            self.configFile.defaultPassword = $( '#dc-settings-default-pwd' )[ 0 ].value;
            self.configFile.encryptScanDelay = $( '#dc-settings-scan-delay' )[ 0 ].value;
            self.configFile.paddingMode = $( '#dc-settings-padding-mode' )[ 0 ].value;
            self.configFile.encryptMode = discordCrypt
                .cipherStringToIndex( $( '#dc-primary-cipher' )[ 0 ].value, $( '#dc-secondary-cipher' )[ 0 ].value );

            $( '#dc-primary-cipher' )[ 0 ].value = discordCrypt
                .cipherIndexToString( self.configFile.encryptMode, false );
            $( '#dc-secondary-cipher' )[ 0 ].value = discordCrypt
                .cipherIndexToString( self.configFile.encryptMode, true );

            /* Handle master password updates if necessary. */
            if ( $( '#dc-master-password' )[ 0 ].value !== '' ) {
                let password = $( '#dc-master-password' )[ 0 ].value;

                /* Reset the password field. */
                $( '#dc-master-password' )[ 0 ].value = '';

                /* Hash the password. */
                discordCrypt.scrypt
                (
                    Buffer.from( password ),
                    Buffer.from( discordCrypt.whirlpool( password, true ), 'hex' ),
                    32,
                    4096,
                    8,
                    1,
                    ( error, progress, pwd ) => {
                        if ( error ) {
                            /* Alert the user. */
                            _alert( 'Error setting the new database password. Check the console for more info.' );

                            discordCrypt.log( error.toString(), 'error' );
                            return true;
                        }

                        if ( pwd ) {
                            /* Now update the password. */
                            self.masterPassword = Buffer.from( pwd, 'hex' );

                            /* Save the configuration file and update the button text. */
                            self.saveSettings( $( '#dc-settings-save-btn' )[ 0 ] );
                        }

                        return false;
                    }
                );
            }
            else {
                /* Save the configuration file and update the button text. */
                self.saveSettings( $( '#dc-settings-save-btn' )[ 0 ] );
            }
        };
    }

    /**
     * @private
     * @desc Resets the user settings to their default values.
     * @param {discordCrypt} self
     * @returns {Function}
     */
    static on_reset_settings_button_clicked( /* discordCrypt */ self ) {
        return () => {
            /* Resets the configuration file and update the button text. */
            self.resetSettings( $( '#dc-settings-reset-btn' )[ 0 ] );

            /* Update all settings from the settings panel. */
            $( '#dc-master-password' )[ 0 ].value = '';
            $( '#dc-settings-default-pwd' )[ 0 ].value = self.configFile.defaultPassword;
            $( '#dc-settings-scan-delay' )[ 0 ].value = self.configFile.encryptScanDelay;
            $( '#dc-settings-encrypt-trigger' )[ 0 ].value = self.configFile.encodeMessageTrigger;
            $( '#dc-settings-padding-mode' )[ 0 ].value = self.configFile.paddingMode.toLowerCase();
            $( '#dc-settings-cipher-mode' )[ 0 ].value = self.configFile.encryptBlockMode.toLowerCase();
            $( '#dc-primary-cipher' )[ 0 ].value = discordCrypt
                .cipherIndexToString( self.configFile.encryptMode, false );
            $( '#dc-secondary-cipher' )[ 0 ].value = discordCrypt
                .cipherIndexToString( self.configFile.encryptMode, true );
        };
    }

    /**
     * @private
     * @desc Restarts the app by performing a window.location.reload()
     */
    static on_restart_now_button_clicked() {
        /* Window reload is simple enough. */
        location.reload();
    }

    /**
     * @private
     * @desc Closes the upload available panel.
     */
    static on_restart_later_button_clicked() {
        /* Hide the update and changelog. */
        $( '#dc-overlay' )[ 0 ].style.display = 'none';
        $( '#dc-update-overlay' )[ 0 ].style.display = 'none';
    }

    /**
     * @private
     * @desc Switches view to the Info tab.
     */
    static on_info_tab_button_clicked() {
        /* Switch to tab 0. */
        discordCrypt.setActiveTab( 0 );
    }

    /**
     * @private
     * @desc Switches view to the Key Exchange tab.
     */
    static on_exchange_tab_button_clicked() {
        /* Switch to tab 1. */
        discordCrypt.setActiveTab( 1 );
    }

    /**
     * @private
     * @desc Switches view to the Handshake tab.
     */
    static on_handshake_tab_button_clicked() {
        /* Switch to tab 2. */
        discordCrypt.setActiveTab( 2 );
    }

    /**
     * @private
     * @desc Closes the key exchange menu.
     */
    static on_close_exchange_button_clicked() {
        /* Hide main background. */
        $( '#dc-overlay' )[ 0 ].style.display = 'none';

        /* Hide the entire exchange key menu. */
        $( '#dc-overlay-exchange' )[ 0 ].style.display = 'none';
    }

    /**
     * @private
     * @desc Opens the key exchange menu.
     */
    static on_open_exchange_button_clicked() {
        /* Show background. */
        $( '#dc-overlay' )[ 0 ].style.display = 'block';

        /* Show main menu. */
        $( '#dc-overlay-exchange' )[ 0 ].style.display = 'block';
    }

    /**
     * @private
     * @desc Generates and sends a new public key.
     */
    static on_quick_send_public_key_button_clicked() {
        /* Don't bother opening a menu. Just generate the key. */
        $( '#dc-keygen-gen-btn' ).click();

        /* Now send it. */
        $( '#dc-keygen-send-pub-btn' ).click();
    }

    /**
     * @private
     * @desc Switches the key lengths to their correct values.
     */
    static on_exchange_algorithm_changed() {
        /* Variable bit lengths. */
        let dh_bl = discordCrypt.getDHBitSizes(), ecdh_bl = discordCrypt.getECDHBitSizes();

        /* Clear the old select list. */
        $( '#dc-keygen-algorithm option' ).each( ( function () {
            $( this ).remove();
        } ) );

        /* Repopulate the entries. */
        switch ( $( '#dc-keygen-method' )[ 0 ].value ) {
            case 'dh':
                for ( let i = 0; i < dh_bl.length; i++ ) {
                    let v = dh_bl[ i ];
                    $( '#dc-keygen-algorithm' )[ 0 ].append( new Option( v, v, i === ( dh_bl.length - 1 ) ) );
                }
                break;
            case 'ecdh':
                for ( let i = 0; i < ecdh_bl.length; i++ ) {
                    let v = ecdh_bl[ i ];
                    $( '#dc-keygen-algorithm' )[ 0 ].append( new Option( v, v, i === ( ecdh_bl.length - 1 ) ) );
                }
                break;
            default:
                return;
        }
    }

    /**
     * @private
     * @desc Generates a new key pair using the selected algorithm.
     */
    static on_generate_new_key_pair_button_clicked() {
        let dh_bl = discordCrypt.getDHBitSizes(), ecdh_bl = discordCrypt.getECDHBitSizes();
        let max_salt_len = 32, min_salt_len = 16, salt_len;
        let index, raw_buffer, pub_buffer;
        let key, crypto = require( 'crypto' );

        /* Get the current algorithm. */
        switch ( $( '#dc-keygen-method' )[ 0 ].value ) {
            case 'dh':
                /* Generate a new Diffie-Hellman RSA key from the bit size specified. */
                key = discordCrypt.generateDH( parseInt( $( '#dc-keygen-algorithm' )[ 0 ].value ) );

                /* Calculate the index number starting from 0. */
                index = dh_bl.indexOf( parseInt( $( '#dc-keygen-algorithm' )[ 0 ].value ) );
                break;
            case 'ecdh':
                /* Generate a new Elliptic-Curve Diffie-Hellman key from the bit size specified. */
                key = discordCrypt.generateECDH( parseInt( $( '#dc-keygen-algorithm' )[ 0 ].value ) );

                /* Calculate the index number starting from dh_bl.length. */
                index = ( ecdh_bl.indexOf( parseInt( $( '#dc-keygen-algorithm' )[ 0 ].value ) ) + dh_bl.length );
                break;
            default:
                /* Should never happen. */
                return;
        }

        /* Sanity check. */
        if (
            !key ||
            key === undefined ||
            typeof key.getPrivateKey === 'undefined' ||
            typeof key.getPublicKey === 'undefined'
        )
            return;

        /* Copy the private key to this instance. */
        discordCrypt.privateExchangeKey = key;

        /*****************************************************************************************
         *   [ PUBLIC PAYLOAD STRUCTURE ]
         *   +0x00 - Algorithm + Bit size [ 0-6 = DH ( 768, 1024, 1536, 2048, 3072, 4096, 8192 ) |
         *                                  7-12 = ECDH ( 224, 256, 384, 409, 521, 571 ) ]
         *   +0x01 - Salt length
         *   +0x02 - Salt[ Salt.length ]
         *   +0x02 + Salt.length - Public key
         ****************************************************************************************/

        /* Calculate a random salt length. */
        salt_len = ( parseInt( crypto.randomBytes( 1 ).toString( 'hex' ), 16 ) % ( max_salt_len - min_salt_len ) ) +
            min_salt_len;

        /* Copy the buffer. */
        pub_buffer = Buffer.from(
            key.getPublicKey( 'hex', $( '#dc-keygen-method' )[ 0 ].value === 'ecdh' ?
                'compressed' :
                undefined
            ),
            'hex'
        );

        /* Create a blank payload. */
        raw_buffer = Buffer.alloc( 2 + salt_len + pub_buffer.length );

        /* Write the algorithm index. */
        raw_buffer.writeInt8( index, 0 );

        /* Write the salt length. */
        raw_buffer.writeInt8( salt_len, 1 );

        /* Generate a random salt and copy it to the buffer. */
        crypto.randomBytes( salt_len ).copy( raw_buffer, 2 );

        /* Copy the public key to the buffer. */
        pub_buffer.copy( raw_buffer, 2 + salt_len );

        /* Get the public key then display it. */
        $( '#dc-pub-key-ta' )[ 0 ].value = raw_buffer.toString( 'hex' );

        /* Get the private key then display it. */
        $( '#dc-priv-key-ta' )[ 0 ].value = key.getPrivateKey( 'hex' );
    }

    /**
     * @private
     * @desc Clears any public and private keys generated.
     */
    static on_keygen_clear_button_clicked() {
        /* Clear the key textareas. */
        $( '#dc-pub-key-ta' )[ 0 ].value = $( '#dc-priv-key-ta' )[ 0 ].value = '';
    }

    /**
     * @private
     * @desc Sends the currently generate public key in the correct format.
     * @param {discordCrypt} self
     * @returns {Function}
     */
    static on_keygen_send_public_key_button_clicked( /* discordCrypt */ self ) {
        return () => {
            /* Don't bother if it's empty. */
            if ( $( '#dc-pub-key-ta' )[ 0 ].value === '' )
                return;

            /* The text area stores a hex encoded binary. Convert it to a Base64 message to save space. */
            let message = Buffer.from( $( '#dc-pub-key-ta' )[ 0 ].value, 'hex' ).toString( 'base64' );

            /* Add the header to the message and encode it. */
            message = self.encodedKeyHeader + discordCrypt.substituteMessage( message, true );

            /* Split the message by adding a new line every 32 characters like a standard PGP message. */
            let formatted_message = message.replace( /(.{32})/g, ( e ) => {
                return `${e}\r\n`
            } );

            /* Calculate the algorithm string. */
            let algo_str = `${$( '#dc-keygen-method' )[ 0 ].value !== 'ecdh' ? 'DH-' : 'ECDH-'}` +
                `${$( '#dc-keygen-algorithm' )[ 0 ].value}`;

            /* Send the message. */
            let header = `-----BEGIN ${algo_str} PUBLIC KEY-----`,
                footer = `-----END ${algo_str} PUBLIC KEY----- | v${self.getVersion().replace( '-debug', '' )}`;

            discordCrypt.sendEmbeddedMessage( formatted_message, header, footer, 0x720000 );

            /* Update the button text & reset after 1 second.. */
            $( '#dc-keygen-send-pub-btn' )[ 0 ].innerText = 'Sent The Public Key!';

            setTimeout( ( function () {
                $( '#dc-keygen-send-pub-btn' )[ 0 ].innerText = 'Send Public Key';
            } ), 1000 );
        };
    }

    /**
     * @private
     * @desc Pastes what is stored in the clipboard to the handshake public key field.
     */
    static on_handshake_paste_public_key_button_clicked() {
        $( '#dc-handshake-ppk' )[ 0 ].value = require( 'electron' ).clipboard.readText();
    }

    /**
     * @private
     * @desc Computes a shared secret and generates passwords based on a DH/ECDH key exchange.
     * @param {discordCrypt} self
     * @returns {Function}
     */
    static on_handshake_compute_button_clicked( /* discordCrypt */ self ) {
        return () => {
            let value, algorithm, payload, salt_len, salt, user_salt_len, user_salt;
            let isUserSaltPrimary;

            /* Provide some way of showing the user the result without actually giving it away. */
            function displaySecret( input_hex ) {
                const charset = "!@#$%^&*()_-+=[{]}\\|'\";:/?.>,<";
                let output = '';

                for ( let i = 0; i < parseInt( input_hex.length / 2 ); i++ )
                    output += charset[ parseInt( input_hex.substr( i * 2, 2 ) ) & ( charset.length - 1 ) ];

                return output;
            }

            /* Skip if no public key was entered. */
            if ( !$( '#dc-handshake-ppk' )[ 0 ].value || !$( '#dc-handshake-ppk' )[ 0 ].value.length )
                return;

            /* Skip if the user hasn't generated a key of their own. */
            if ( !$( '#dc-pub-key-ta' )[ 0 ].value || !$( '#dc-pub-key-ta' )[ 0 ].value.length ) {
                /* Update the text. */
                $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'You Didn\'t Generate A Key!';
                setTimeout( ( function () {
                    $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Compute Secret Keys';
                } ), 1000 );
                return;
            }

            /* Check if the message header is valid. */
            if (
                $( '#dc-handshake-ppk' )[ 0 ].value.replace( /\r?\n|\r/g, "" )
                    .slice( 0, 4 ) !== self.encodedKeyHeader
            )
                return;

            /* Snip off the header. */
            let blob = $( '#dc-handshake-ppk' )[ 0 ].value.replace( /\r?\n|\r/g, "" ).slice( 4 );

            /* Skip if invalid UTF-16 encoded message. */
            if ( !discordCrypt.isValidUtf16( blob ) )
                return;

            try {
                /* Decode the message. */
                value = Buffer.from( discordCrypt.substituteMessage( blob ), 'base64' );
            }
            catch ( e ) {
                /* Update the text. */
                $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Invalid Public Key!';
                setTimeout( ( function () {
                    $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Compute Secret Keys';
                } ), 1000 );
                return;
            }

            /* Check the algorithm they're using is the same as ours. */
            algorithm = value.readInt8( 0 );

            /* Check the algorithm is valid. */
            if ( !discordCrypt.isValidExchangeAlgorithm( algorithm ) ) {
                /* Update the text. */
                $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Invalid Algorithm!';
                setTimeout( ( function () {
                    $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Compute Secret Keys';
                } ), 1000 );
                return;
            }

            /* Read the user's generated public key. */
            let user_pub_key = Buffer.from( $( '#dc-pub-key-ta' )[ 0 ].value, 'hex' );

            /* Check the algorithm used is the same as ours. */
            if ( user_pub_key.readInt8( 0 ) !== algorithm ) {
                /* Update the text. */
                $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Mismatched Algorithm!';
                setTimeout( ( function () {
                    $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Compute Secret Keys';
                } ), 1000 );
                return;
            }

            /* Update the algorithm text. */
            $( '#dc-handshake-algorithm' )[ 0 ].innerText =
                `Exchange Algorithm: ${discordCrypt.indexToExchangeAlgorithmString( algorithm )}`;

            /* Get the salt length. */
            salt_len = value.readInt8( 1 );

            /* Make sure the salt length is valid. */
            if ( salt_len < 16 || salt_len > 32 ) {
                /* Update the text. */
                $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Invalid Salt Length!';
                setTimeout( ( function () {
                    $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Compute Secret Keys';
                } ), 1000 );
                return;
            }

            /* Read the public salt. */
            salt = Buffer.from( value.subarray( 2, 2 + salt_len ) );

            /* Read the user's salt length. */
            user_salt_len = user_pub_key.readInt8( 1 );

            /* Read the user salt. */
            user_salt = Buffer.from( user_pub_key.subarray( 2, 2 + user_salt_len ) );

            /* Update the salt text. */
            $( '#dc-handshake-salts' )[ 0 ].innerText =
                `Salts: [ ${displaySecret( salt.toString( 'hex' ) )}, ` +
                `${displaySecret( user_salt.toString( 'hex' ) )} ]`;

            /* Read the public key and convert it to a hex string. */
            payload = Buffer.from( value.subarray( 2 + salt_len ) ).toString( 'hex' );

            /* Return if invalid. */
            if ( !discordCrypt.privateExchangeKey || discordCrypt.privateExchangeKey === undefined ||
                typeof discordCrypt.privateExchangeKey.computeSecret === 'undefined' ) {
                /* Update the text. */
                $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Failed To Calculate Private Key!';
                setTimeout( ( function () {
                    $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Compute Secret Keys';
                } ), 1000 );
                return;
            }

            /* Compute the local secret as a hex string. */
            let derived_secret =
                discordCrypt.computeExchangeSharedSecret( discordCrypt.privateExchangeKey, payload, false, false );

            /* Show error and quit if derivation fails. */
            if ( !derived_secret || !derived_secret.length ) {
                /* Update the text. */
                $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Failed To Derive Key!';
                setTimeout( ( function () {
                    $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Compute Secret Keys';
                } ), 1000 );
                return;
            }

            /* Display the first 32 characters of it. */
            $( '#dc-handshake-secret' )[ 0 ].innerText =
                `Derived Secret: [ ${displaySecret( derived_secret.length > 64 ?
                    derived_secret.substring( 0, 64 ) :
                    derived_secret )
                    } ]`;

            /* We have two salts. We can't know which one is our primary salt so just do a simple check on which
             Salt32 is bigger. */
            if ( user_salt_len === salt_len ) {
                for ( let i = 2; i < parseInt( user_salt_len / 4 ); i += 4 ) {
                    let usl = user_salt.readUInt32BE( i ), sl = salt.readUInt32BE( i );

                    if ( usl === sl )
                        continue;

                    isUserSaltPrimary = usl > sl;
                    break;
                }

                /* Salts are equal, should never happen. */
                if ( isUserSaltPrimary === undefined ) {
                    /* Update the text. */
                    $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Both Salts Are Equal ?!';
                    setTimeout(
                        ( function () {
                            $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Compute Secret Keys';
                        } ),
                        1000
                    );
                    return;
                }
            }
            else
                isUserSaltPrimary = user_salt_len > salt_len;

            /* Create hashed salt from the two user-generated salts. */
            let primary_hash = Buffer.from(
                discordCrypt.sha512( isUserSaltPrimary ? user_salt : salt, true ),
                'hex'
            );
            let secondary_hash = Buffer.from(
                discordCrypt.whirlpool( isUserSaltPrimary ? salt : user_salt, true ),
                'hex'
            );

            /* Global progress for async callbacks. */
            let primary_progress = 0, secondary_progress = 0;

            /* Calculate the primary key. */
            discordCrypt.scrypt(
                Buffer.from( derived_secret + secondary_hash.toString( 'hex' ), 'hex' ),
                primary_hash,
                256,
                3072,
                16,
                2,
                ( error, progress, key ) => {
                    if ( error ) {
                        /* Update the text. */
                        $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Failed Generating Primary Key!';
                        setTimeout(
                            ( function () {
                                $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Compute Secret Keys';
                            } ),
                            1000
                        );
                        return true;
                    }

                    /* Update progress. */
                    if ( progress ) {
                        primary_progress = progress * 50;

                        $( '#dc-exchange-status' )
                            .css( 'width', `${parseInt( primary_progress + secondary_progress )}%` );
                    }

                    if ( key ) {
                        /* Generate a quality report and apply the password. */
                        $( '#dc-handshake-prim-lbl' ).text( `Primary Key: ( Quality - ${
                            discordCrypt.entropicBitLength( key.toString( 'base64' ) )
                            } Bits )` );
                        $( '#dc-handshake-primary-key' )[ 0 ].value = key.toString( 'base64' );

                        /* Since more iterations are done for the primary key, this takes 4x as long thus will
                           always finish second. We can thus restore the original Generate text for the button once
                           this is done. */
                        $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Compute Secret Keys';

                        /* Now we clear the additional information. */
                        $( '#dc-handshake-algorithm' )[ 0 ].innerText = '...';
                        $( '#dc-handshake-secret' )[ 0 ].innerText = '...';
                        $( '#dc-handshake-salts' )[ 0 ].innerText = '...';
                        $( '#dc-exchange-status' ).css( 'width', '0%' );
                    }

                    return false;
                }
            );

            /* Calculate all salts needed. */
            let primary_salt = isUserSaltPrimary ? user_salt : salt;
            let secondary_salt = isUserSaltPrimary ? salt : user_salt;
            let secondary_password = Buffer.from(
                primary_salt.toString( 'hex' ) + derived_secret + secondary_salt.toString( 'hex' ),
                'hex'
            );

            /* Calculate the secondary key. */
            discordCrypt.scrypt( secondary_password, secondary_hash, 256, 3072, 8, 1, ( error, progress, key ) => {
                if ( error ) {
                    /* Update the text. */
                    $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Failed Generating Secondary Key!';
                    setTimeout(
                        ( function () {
                            $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Compute Secret Keys';
                        } ),
                        1000
                    );
                    return true;
                }

                if ( progress ) {
                    secondary_progress = progress * 50;
                    $( '#dc-exchange-status' ).css( 'width', `${parseInt( primary_progress + secondary_progress )}%` );
                }

                if ( key ) {
                    /* Generate a quality report and apply the password. */
                    $( '#dc-handshake-sec-lbl' ).text( `Secondary Key: ( Quality - ${
                        discordCrypt.entropicBitLength( key.toString( 'base64' ) )
                        } Bits )` );
                    $( '#dc-handshake-secondary-key' )[ 0 ].value = key.toString( 'base64' );
                }

                return false;
            } );

            /* Update the text. */
            $( '#dc-handshake-compute-btn' )[ 0 ].innerText = 'Generating Keys ...';

            /* Finally clear all volatile information. */
            discordCrypt.privateExchangeKey = undefined;
            $( '#dc-handshake-ppk' )[ 0 ].value = '';
            $( '#dc-priv-key-ta' )[ 0 ].value = '';
            $( '#dc-pub-key-ta' )[ 0 ].value = '';
        };
    }

    /**
     * @private
     * @desc Copies the currently generated passwords from a key exchange to the clipboard then erases them.
     */
    static on_handshake_copy_keys_button_clicked() {
        /* Don't bother if it's empty. */
        if ( $( '#dc-handshake-primary-key' )[ 0 ].value === '' ||
            $( '#dc-handshake-secondary-key' )[ 0 ].value === '' )
            return;

        /* Format the text and copy it to the clipboard. */
        require( 'electron' ).clipboard.writeText(
            `Primary Key: ${$( '#dc-handshake-primary-key' )[ 0 ].value}\r\n\r\n` +
            `Secondary Key: ${$( '#dc-handshake-secondary-key' )[ 0 ].value}`
        );

        /* Nuke. */
        $( '#dc-handshake-primary-key' )[ 0 ].value = $( '#dc-handshake-secondary-key' )[ 0 ].value = '';

        /* Update the button text & reset after 1 second. */
        $( '#dc-handshake-cpy-keys-btn' )[ 0 ].innerText = 'Coped Keys To Clipboard!';

        setTimeout( ( function () {
            $( '#dc-handshake-cpy-keys-btn' )[ 0 ].innerText = 'Copy Keys & Nuke';
            $( '#dc-handshake-prim-lbl' ).text( 'Primary Key: ' );
            $( '#dc-handshake-sec-lbl' ).text( 'Secondary Key: ' );
        } ), 1000 );
    }

    /**
     * @private
     * @desc Applies the generate passwords to the current channel or DM.
     * @param {discordCrypt} self
     * @returns {Function}
     */
    static on_handshake_apply_keys_button_clicked( /* discordCrypt */ self ) {
        return () => {
            /* Skip if no primary key was generated. */
            if ( !$( '#dc-handshake-primary-key' )[ 0 ].value || !$( '#dc-handshake-primary-key' )[ 0 ].value.length )
                return;

            /* Skip if no secondary key was generated. */
            if ( !$( '#dc-handshake-secondary-key' )[ 0 ].value ||
                !$( '#dc-handshake-secondary-key' )[ 0 ].value.length )
                return;

            /* Create the password object and nuke. */
            let pwd = discordCrypt.createPassword(
                $( '#dc-handshake-primary-key' )[ 0 ].value,
                $( '#dc-handshake-secondary-key' )[ 0 ].value
            );
            $( '#dc-handshake-primary-key' )[ 0 ].value = $( '#dc-handshake-secondary-key' )[ 0 ].value = '';

            /* Apply the passwords and save the config. */
            self.configFile.passList[ discordCrypt.getChannelId() ] = pwd;
            self.saveConfig();

            /* Update the text and reset it after 1 second. */
            $( '#dc-handshake-apply-keys-btn' )[ 0 ].innerText = 'Applied & Saved!';
            setTimeout( ( function () {
                $( '#dc-handshake-apply-keys-btn' )[ 0 ].innerText = 'Apply Generated Passwords';

                /* Reset quality bit length fields. */
                $( '#dc-handshake-prim-lbl' ).text( 'Primary Key: ' );
                $( '#dc-handshake-sec-lbl' ).text( 'Secondary Key: ' );

                /* Hide main background. */
                $( '#dc-overlay' )[ 0 ].style.display = 'none';

                /* Hide the entire exchange key menu. */
                $( '#dc-overlay-exchange' )[ 0 ].style.display = 'none';

                /* Reset the index to the info tab. */
                discordCrypt.setActiveTab( 0 );
            } ), 1000 );
        }
    }

    /**
     * @private
     * @desc Opens the password editor menu.
     */
    static on_passwd_button_clicked() {
        $( '#dc-overlay' )[ 0 ].style.display = 'block';
        $( '#dc-overlay-password' )[ 0 ].style.display = 'block';
    }

    /**
     * @private
     * @desc Saves the entered passwords for the current channel or DM.
     * @param {discordCrypt} self
     * @returns {Function}
     */
    static on_save_passwords_button_clicked( /* discordCrypt */ self ) {
        return () => {
            let btn = $( '#dc-save-pwd' );

            /* Update the password and save it. */
            self.updatePasswords();

            /* Update the text for the button. */
            btn.text( "Saved!" );

            /* Reset the text for the password button after a 1 second delay. */
            setTimeout( ( function () {
                /* Reset text. */
                btn.text( "Save Password" );

                /* Clear the fields. */
                $( "#dc-password-primary" )[ 0 ].value = '';
                $( "#dc-password-secondary" )[ 0 ].value = '';

                /* Close. */
                $( '#dc-overlay' )[ 0 ].style.display = 'none';
                $( '#dc-overlay-password' )[ 0 ].style.display = 'none';
            } ), 1000 );
        };
    }

    /**
     * @private
     * @desc Resets passwords for the current channel or DM to their defaults.
     * @param {discordCrypt} self
     * @returns {Function}
     */
    static on_reset_passwords_button_clicked( /* discordCrypt */ self ) {
        return () => {
            let btn = $( '#dc-reset-pwd' );

            /* Reset the configuration for this user and save the file. */
            delete self.configFile.passList[ discordCrypt.getChannelId() ];
            self.saveConfig();

            /* Update the text for the button. */
            btn.text( "Password Reset!" );

            setTimeout( ( function () {
                /* Reset text. */
                btn.text( "Reset Password" );

                /* Clear the fields. */
                $( "#dc-password-primary" )[ 0 ].value = '';
                $( "#dc-password-secondary" )[ 0 ].value = '';

                /* Close. */
                $( '#dc-overlay' )[ 0 ].style.display = 'none';
                $( '#dc-overlay-password' )[ 0 ].style.display = 'none';
            } ), 1000 );
        };
    }

    /**
     * @private
     * @desc Closes the password editor menu.
     */
    static on_cancel_password_button_clicked() {
        /* Clear the fields. */
        $( "#dc-password-primary" )[ 0 ].value = '';
        $( "#dc-password-secondary" )[ 0 ].value = '';

        /* Close after a .25 second delay. */
        setTimeout( ( function () {
            /* Close. */
            $( '#dc-overlay' )[ 0 ].style.display = 'none';
            $( '#dc-overlay-password' )[ 0 ].style.display = 'none';
        } ), 250 );
    }

    /**
     * @private
     * @desc Copies the passwords from the current channel or DM to the clipboard.
     * @param {discordCrypt} self
     * @returns {Function}
     */
    static on_copy_current_passwords_button_clicked( /* discordCrypt */ self ) {
        return () => {
            let currentKeys = self.configFile.passList[ discordCrypt.getChannelId() ];

            /* If no password is currently generated, write the default key. */
            if ( !currentKeys ) {
                require( 'electron' ).clipboard.writeText( `Default Password: ${self.configFile.defaultPassword}` );
                return;
            }

            /* Write to the clipboard. */
            require( 'electron' ).clipboard.writeText(
                `Primary Key: ${currentKeys.primary}\r\n\r\nSecondary Key: ${currentKeys.secondary}`
            );

            /* Alter the button text. */
            $( '#dc-cpy-pwds-btn' ).text( 'Copied Keys To Clipboard!' );

            /* Reset the button after 1 second close the prompt. */
            setTimeout( ( function () {
                /* Reset. */
                $( '#dc-cpy-pwds-btn' ).text( 'Copy Current Passwords!' );

                /* Close. */
                $( '#dc-cancel-btn' ).click();
            } ), 1000 );
        };
    }

    /**
     * @private
     * @desc Enables or disables automatic message encryption.
     * @param {discordCrypt} self
     * @returns {Function}
     */
    static on_lock_button_clicked( /* discordCrypt */ self ) {
        return () => {
            /* Update the icon and toggle. */
            if ( !self.configFile.encodeAll ) {
                $( '#dc-lock-btn' ).attr( 'title', 'Disable Message Encryption' );
                $( '#dc-lock-btn' )[ 0 ].innerHTML = Buffer.from( self.lockIcon, 'base64' ).toString( 'utf8' );
                self.configFile.encodeAll = true;
            }
            else {
                $( '#dc-lock-btn' ).attr( 'title', 'Enable Message Encryption' );
                $( '#dc-lock-btn' )[ 0 ].innerHTML = Buffer.from( self.unlockIcon, 'base64' ).toString( 'utf8' );
                self.configFile.encodeAll = false;
            }

            /* Set the button class. */
            $( '.dc-svg' ).attr( 'class', 'dc-svg' );

            /* Save config. */
            self.saveConfig();
        };
    }

    /* ================ END UI HANDLE CALLBACKS ================ */

    /* =================== END MAIN CALLBACKS ================== */

    /* =============== BEGIN CRYPTO CALLBACKS ================== */

    /* ======================= UTILITIES ======================= */

    /**
     * @callback getResultCallback
     * @param {int} statusCode The HTTP static code of the operation.
     * @param {string|null} The HTTP error string if an error occurred.
     * @param {string} data The returned data from the request.
     */

    /**
     * @private
     * @desc Checks if the plugin should ignore auto-updates.
     *      Usually in a developer environment, a simple symlink is ( or should be ) used to link the current build
     *      file to the plugin path allowing faster deployment.
     * @param {string} version Version string of the plugin to include in the check.
     * @return {boolean} Returns false if the plugin should auto-update.
     */
    static __shouldIgnoreUpdates( version ) {
        const fs = require( 'fs' );
        const path = require( 'path' );
        const plugin_file = path.join( discordCrypt.getPluginsPath(), discordCrypt.getPluginName() );

        return fs.existsSync( plugin_file ) &&
            ( fs.lstatSync( plugin_file ).isSymbolicLink() || version.indexOf( '-debug' ) !== -1 );
    }

    /**
     * @public
     * @desc Performs an HTTP request returns the result to the callback.
     * @param {string} url The URL of the request.
     * @param {getResultCallback} callback The callback triggered when the request is complete or an error occurs.
     * @private
     */
    static __getRequest( url, callback ) {
        try {
            require( 'request' )( url, ( error, response, result ) => {
                callback( response.statusCode, response.statusMessage, result );
            } );
        }
        catch ( ex ) {
            callback( -1, ex.toString() );
        }
    }

    /**
     * @private
     * @desc Get React component instance of closest owner of DOM element matched by filter.
     * @author noodlebox
     * @param {Element} element DOM element to start react component searching.
     * @param {object} options Filter to match React component by display name.
     *      If `include` if provided, `exclude` value is ignored.
     * @param {string[]} options.include Array of names to allow.
     * @param {string[]} options.exclude Array of names to ignore.
     * @return {object|null} Closest matched React component instance or null if none is matched.
     */
    static __getElementReactOwner(
        element,
        {
            include,
            exclude = [ "Popout", "Tooltip", "Scroller", "BackgroundFlash" ]
        } = {}
    ) {
        if ( element === undefined )
            return undefined;

        /**
         * Get React Internal Instance mounted to DOM element
         * @author noodlebox
         * @param {Element} e DOM element to get React Internal Instance from
         * @return {object|null} Returns React Internal Instance mounted to this element if exists
         */
        const getOwnerReactInstance = e => e[ Object.keys( e ).find( k => k.startsWith( "__reactInternalInstance" ) ) ];
        const excluding = include === undefined;
        const filter = excluding ? exclude : include;

        function classFilter( owner ) {
            const name = owner.type.displayName || owner.type.name || null;
            return ( name !== null && !!( filter.includes( name ) ^ excluding ) );
        }

        for ( let c = getOwnerReactInstance( element ).return; !_.isNil( c ); c = c.return ) {
            if ( _.isNil( c ) )
                continue;

            if ( !_.isNil( c.stateNode ) && !( c.stateNode instanceof HTMLElement ) && classFilter( c ) )
                return c.stateNode;
        }

        return undefined;
    }

    /**
     * @public
     * @desc Returns the exchange algorithm and bit size for the given metadata as well as a fingerprint.
     * @param {string} key_message The encoded metadata to extract the information from.
     * @param {boolean} header_present Whether the message's magic string is attached to the input.
     * @returns {{bit_length: int, algorithm: string, fingerprint: string}|null} Returns the algorithm's bit length and
     *      name or null.
     * @example
     * __extractKeyInfo( '㑼㑷㑵㑳㐁㑢', true );
     * @example
     * __extractKeyInfo( '㐁㑢', false );
     */
    static __extractKeyInfo( key_message, header_present = false ) {
        try {
            let output = [];
            let msg = key_message;

            /* Strip the header if necessary. */
            if ( header_present )
                msg = msg.slice( 4 );

            /* Decode the message to Base64. */
            msg = discordCrypt.substituteMessage( msg );

            /* Decode the message to raw bytes. */
            msg = Buffer.from( msg, 'base64' );

            /* Sanity check. */
            if ( !discordCrypt.isValidExchangeAlgorithm( msg[ 0 ] ) )
                return null;

            /* Create a fingerprint for the blob. */
            output[ 'fingerprint' ] = discordCrypt.sha256( msg, true );

            /* Buffer[0] contains the algorithm type. Reverse it. */
            output[ 'bit_length' ] = discordCrypt.indexToAlgorithmBitLength( msg[ 0 ] );
            output[ 'algorithm' ] = discordCrypt.indexToExchangeAlgorithmString( msg[ 0 ] )
                .split( '-' )[ 0 ].toLowerCase();

            return output;
        }
        catch ( e ) {
            return null;
        }
    }

    /**
     * @public
     * @desc Splits the input text into chunks according to the specified length.
     * @param {string} input_string The input string.
     * @param {int} max_length The maximum length of the string before splitting.
     * @returns {Array} An array of split strings.
     * @private
     */
    static __splitStringChunks( input_string, max_length ) {
        /* Sanity check. */
        if ( !max_length || max_length < 0 )
            return input_string;

        /* Calculate the maximum number of chunks this can be split into. */
        const num_chunks = Math.ceil( input_string.length / max_length );
        const ret = new Array( num_chunks );

        /* Split each chunk and add it to the output array. */
        for ( let i = 0, offset = 0; i < num_chunks; ++i, offset += max_length )
            ret[ i ] = input_string.substr( offset, max_length );

        return ret;
    }

    /**
     * @public
     * @desc Determines if the given string is a valid username according to Discord's standards.
     * @param {string} name The name of the user and their discriminator.
     * @returns {boolean} Returns true if the username is valid.
     * @example
     * console.log( __isValidUserName( 'Person#1234' ) ); // true
     * @example
     * console.log( __isValidUserName( 'Person#123' ) ); // false
     * @example
     * console.log( __isValidUserName( 'Person#' ) ); // false
     * @example
     * console.log( __isValidUserName( 'Person1234' ) ); // false
     */
    static __isValidUserName( name ) {
        /* Make sure this is actually a string. */
        if ( typeof name !== 'string' )
            return false;

        /* The name must start with the '@' symbol. */
        if ( name[ 0 ] !== '@' )
            return false;

        /* Iterate through the rest of the name and check for the correct format. */
        for ( let i = 1; i < name.length; i++ ) {
            /* Names can't have spaces or '@' symbols. */
            if ( name[ i ] === ' ' || name[ i ] === '@' )
                return false;

            /* Make sure the discriminator is present. */
            if ( i !== 1 && name[ i ] === '#' ) {
                /* The discriminator is 4 characters long. */
                if ( name.length - i - 1 === 4 ) {
                    try {
                        /* Slice off the discriminator. */
                        let n = name.slice( i + 1, i + 5 );
                        /* Do a weak check to ensure that the Base-10 parsed integer is the same as the string. */
                        return !isNaN( n ) && parseInt( n, 10 ) == n;
                    }
                        /* If parsing or slicing somehow fails, this isn't valid. */
                    catch ( e ) {
                        return false;
                    }
                }
            }
        }

        /* No discriminator found means it's invalid. */
        return false;
    }

    /**
     * @public
     * @desc Extracts all tags from the given message and removes any tagged discriminators.
     * @param {string} message The input message to extract all tags from.
     * @returns {{ processed_message: string, user_tags: Array }}
     */
    static __extractTags( message ) {
        let split_msg = message.split( ' ' );
        let cleaned_tags = '', cleaned_msg = '';
        let user_tags = [];

        /* Iterate over each segment and check for usernames. */
        for ( let i = 0, k = 0; i < split_msg.length; i++ ) {
            if ( this.__isValidUserName( split_msg[ i ] ) ) {
                user_tags[ k++ ] = split_msg[ i ];
                cleaned_msg += `${split_msg[ i ].split( '#' )[ 0 ]} `;
            }
            /* Check for @here or @everyone. */
            else if ( split_msg[ i ] === '@everyone' || split_msg[ i ] === '@here' ) {
                user_tags[ k++ ] = split_msg[ i ];
                cleaned_msg += `${split_msg[ i ]} `;
            }
            else
                cleaned_msg += `${split_msg[ i ]} `;
        }

        /* Join all tags to a single string. */
        for ( let i = 0; i < user_tags.length; i++ )
            cleaned_tags += `${user_tags[ i ]} `;

        /* Return the parsed message and user tags. */
        return [ cleaned_msg.trim(), cleaned_tags.trim() ];
    }

    /**
     * @callback codeBlockDescriptor
     * @param {int} start_pos The starting position of the code block.
     * @param {int} end_pos The ending position of the code block.
     * @param {string} language The language identifier of the code within this block.
     * @param {string} raw_code The raw code within the code block.
     * @param {string} captured_block The entire markdown formatted code block.
     */

    /**
     * @public
     * @desc Extracts raw code blocks from a message and returns a descriptive array.
     *      N.B. This does not remove the code blocks from the message.
     * @param {string} message The message to extract all code blocks from.
     * @returns {Array} Returns an array of codeBlockDescriptor() objects.
     */
    static __extractCodeBlocks( message ) {
        /* This regex only extracts code blocks. */
        let code_block_expr = new RegExp( /^(([ \t]*`{3,4})([^\n]*)([\s\S]+?)(^[ \t]*\2))/gm ),
            inline_block_expr = new RegExp( /(`([^`].*?)`)/g ),
            _matched;

        /* Array to store all the extracted blocks in. */
        let _code_blocks = [];

        /* Loop through each tested RegExp result. */
        while ( ( _matched = code_block_expr.exec( message ) ) ) {
            /* Insert the captured data. */
            _code_blocks.push( {
                start_pos: _matched.index,
                end_pos: _matched.index + _matched[ 1 ].length,
                language: _matched[ 3 ].trim().length === 0 ? 'text' : _matched[ 3 ].trim(),
                raw_code: _matched[ 4 ],
                captured_block: _matched[ 1 ]
            } );
        }

        /* Match inline code blocks. */
        while ( ( _matched = inline_block_expr.exec( message ) ) ) {
            /* Insert the captured data. */
            _code_blocks.push( {
                start_pos: _matched.index,
                end_pos: _matched.index + _matched[ 0 ].length,
                language: 'inline',
                raw_code: message
                    .substr( _matched.index, _matched.index + _matched[ 0 ].length )
                    .split( '`' )[ 1 ],
                captured_block: _matched[ 0 ]
            } );
        }

        return _code_blocks;
    }

    /**
     * @public
     * @desc Extracts raw URLs from a message.
     *      N.B. This does not remove the URLs from the message.
     * @param {string} message The message to extract the URLs from.
     * @returns {Array} Returns an array of URLs detected int the message.
     * @example
     * __extractUrls( 'Hello https://google.com' );
     * //
     * [ 'https://google.com' ]
     */
    static __extractUrls( message ) {
        /* This regex only extracts HTTP/HTTPS/FTP and FILE URLs. */
        let url_expr = new RegExp( /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig ),
            matched;

        /* Array to store all the extracted URLs in. */
        let urls = [];

        /* Loop through each tested RegExp result. */
        while ( ( matched = url_expr.exec( message ) ) ) {
            /* Insert the captured data. */
            urls.push( matched[ 0 ] );
        }

        return urls;
    }

    /**
     * @public
     * @desc Extracts code blocks from a message and formats them in HTML to the proper format.
     * @param {string} message The message to format code blocks from.
     * @returns {{code: boolean, html: string}} Returns whether the message contains code blocks and the formatted HTML.
     * @example
     * __buildCodeBlockMessage('```\nHello World!\n```');
     * //
     * {
     *      "code": true,
     *      "html": "<div class=\"markup line-scanned\" data-colour=\"true\" style=\"color: rgb(111, 0, 0);\">
     *                  <pre class=\"hljs\">
     *                      <code class=\"dc-code-block hljs\" style=\"position: relative;\">
     *                          <ol><li>Hello World!</li></ol>
     *                      </code>
     *                  </pre>
     *              </div>"
     * }
     */
    static __buildCodeBlockMessage( message ) {
        try {
            /* Extract code blocks. */
            let _extracted = discordCrypt.__extractCodeBlocks( message );

            /* Throw an exception which will be caught to wrap the message normally. */
            if ( !_extracted.length )
                throw 'No code blocks available.';

            /* Loop over each expanded code block. */
            for ( let i = 0; i < _extracted.length; i++ ) {
                /* Inline code blocks get styled differently. */
                if ( _extracted[ i ].language !== 'inline' ) {
                    let _lines = '';

                    /* Remove any line-reset characters and split the message into lines. */
                    let _code = _extracted[ i ].raw_code.replace( "\r", '' ).split( "\n" );

                    /* Wrap each line in list elements. */
                    /* We start from position 1 since the regex leaves us with 2 blank lines. */
                    for ( let j = 1; j < _code.length - 1; j++ )
                        _lines += `<li>${_code[ j ]}</li>`;

                    /* Split the HTML message according to the full markdown code block. */
                    message = message.split( _extracted[ i ].captured_block );

                    /* Replace the code with an HTML formatted code block. */
                    message = message.join(
                        '<div class="markup line-scanned" data-colour="true" style="color: rgb(111, 0, 0);">' +
                        `<pre class="hljs"><code class="dc-code-block hljs 
                        ${_extracted[ i ].language === 'text' ? '' : _extracted[ i ].language}"
                         style="position: relative;">` +
                        `<ol>${_lines}</ol></code></pre></div>`
                    );
                }
                else {
                    /* Split the HTML message according to the inline markdown code block. */
                    message = message.split( _extracted[ i ].captured_block );

                    /* Replace the data with a inline code class. */
                    message = message.join( `<code class="inline">${_extracted[ i ].raw_code}</code>` );
                }
            }

            /* Return the parsed message. */
            return {
                code: true,
                html: message
            };
        }
        catch ( e ) {
            /* Wrap the message normally. */
            return {
                code: false,
                html: message
            };
        }
    }

    /**
     * @public
     * @desc Extracts URLs from a message and formats them accordingly.
     * @param {string} message The input message to format URLs from.
     * @param {string} [embed_link_prefix] Optional search link prefix for URLs to embed in frames.
     * @returns {{url: boolean, html: string}} Returns whether the message contains URLs and the formatted HTML.
     */
    static __buildUrlMessage( message, embed_link_prefix ) {
        try {
            /* Extract the URLs. */
            let _extracted = discordCrypt.__extractUrls( message );

            /* Throw an exception which will be caught to wrap the message normally. */
            if ( !_extracted.length )
                throw 'No URLs available.';

            /* Loop over each URL and format it. */
            for ( let i = 0; i < _extracted.length; i++ ) {
                let join = '';

                /* Split the message according to the URL and replace it. */
                message = message.split( _extracted[ i ] );

                /* If this is an Up1 host, we can directly embed it. Obviously don't embed deletion links.*/
                if (
                    embed_link_prefix !== undefined &&
                    _extracted[ i ].startsWith( `${embed_link_prefix}/#` ) &&
                    _extracted[ i ].indexOf( 'del?ident=' ) === -1
                )
                    join = `<iframe src=${_extracted[ i ]} width="400px" height="400px"></iframe><br/><br/>`;

                /* Join the message together. */
                message = message.join( `${join}<a target="_blank" href="${_extracted[ i ]}">${_extracted[ i ]}</a>` );
            }

            /* Wrap the message in span tags. */
            return {
                url: true,
                html: `<span>${message}</span>`
            };
        }
        catch ( e ) {
            /* Wrap the message normally. */
            return {
                url: false,
                html: message
            };
        }
    }

    /**
     * @public
     * @desc Returns a string, Buffer() or Array() as a buffered object.
     * @param {string|Buffer|Array} input The input variable.
     * @param {boolean|undefined} [is_input_hex] If set to true, the input is parsed as a hex string. If false, it is
     *      parsed as a Base64 string. If this value is undefined, it is parsed as a UTF-8 string.
     * @returns {Buffer} Returns a Buffer object.
     * @throws {string} Thrown an unsupported type error if the input is neither a string, Buffer or Array.
     */
    static __toBuffer( input, is_input_hex = undefined ) {

        /* No conversion needed, return it as-is. */
        if ( Buffer.isBuffer( input ) )
            return input;

        /* If the message is either a Hex, Base64 or UTF-8 encoded string, convert it to a buffer. */
        if ( typeof input === 'string' )
            return Buffer.from( input, is_input_hex === undefined ? 'utf8' : is_input_hex ? 'hex' : 'base64' );

        /* Convert the Array to a Buffer object first. */
        if ( Array.isArray( input ) )
            return Buffer.from( input );

        /* Throw if an invalid type was passed. */
        throw 'Input is neither an Array(), Buffer() or a string.';
    }

    /**
     * @public
     * @desc Creates a hash of the specified algorithm and returns either a hex-encoded or base64-encoded digest.
     * @param {string|Buffer|Array} message The message to perform the hash on.
     * @param {string} algorithm The specified hash algorithm to use.
     * @param {boolean} [to_hex] If true, converts the output to hex else it converts it to Base64.
     * @param {boolean} hmac If this is true, an HMAC hash is created using a secret.
     * @param {string|Buffer|Array} secret The input secret used for the creation of an HMAC object.
     * @returns {string} Returns either a Base64 or hex string on success and an empty string on failure.
     * @example
     * console.log( __createHash( 'Hello World!', 'sha256', true ) );
     * // "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
     * @example
     * console.log( __createHash( 'Hello World', 'sha256', true, true, 'My Secret' ) );
     * // "852f78f917c4408000a8a94be61687865000bec5b2b77c0704dc5ad73ea06368"
     */
    static __createHash( message, algorithm, to_hex, hmac, secret ) {
        try {
            const crypto = require( 'crypto' );

            /* Create the hash algorithm. */
            const hash = hmac ? crypto.createHmac( algorithm, secret ) :
                crypto.createHash( algorithm );

            /* Hash the data. */
            hash.update( message );

            /* Return the digest. */
            return hash.digest( to_hex ? 'hex' : 'base64' );
        }
        catch ( e ) {
            return '';
        }
    }

    /**
     * @callback pbkdf2Callback
     * @param {string} error The error that occurred during processing or null on success.
     * @param {string} hash The hash either as a hex or Base64 encoded string ( or null on failure ).
     */

    /**
     * @public
     * @desc Computes a key-derivation based on the PBKDF2 standard and returns a hex or base64 encoded digest.
     * @param {string|Buffer|Array} input The input value to hash.
     * @param {string|Buffer|Array} salt The secret value used to derive the hash.
     * @param {boolean} [to_hex] Whether to conver the result to a hex string or a Base64 string.
     * @param {boolean} [is_input_hex] Whether to treat the input as a hex or Base64 string.
     *      If undefined, it is interpreted as a UTF-8 string.
     * @param {boolean} [is_salt_hex] Whether to treat the salt as a hex or Base64 string.
     *      If undefined, it is interpreted as a UTF-8 string.
     * @param {pbkdf2Callback} [callback] The callback function if performing an async request.
     * @param {string} algorithm The name of the hash algorithm to use.
     * @param {int} key_length The length of the desired key in bytes.
     * @param {int} iterations The number of recursive iterations to use to produce the resulting hash.
     * @returns {string} If a callback is not specified, this returns the hex or Base64 result or an empty string on
     *      failure.
     * @example
     * __pbkdf2( 'Hello World!', 'Super Secret', true, undefined, undefined, undefined, 'sha256', 32, 10000 );
     * // "89205432badb5b1e53c7bb930d428afd0f98e5702c4e549ea2da4cfefe8af254"
     * @example
     * __pbkdf2( 'ABC', 'Salty!', true, undefined, undefined, ( e, h ) => { console.log( `Hash: ${h}` ); },
     *      'sha256', 32, 1000 );
     * // Hash: f0e110b17b02006bbbcecb8eb295421c69081a6ecda75c94d55d20759dc295b1
     */
    static __pbkdf2( input, salt, to_hex, is_input_hex, is_salt_hex, callback, algorithm, key_length, iterations ) {
        const crypto = require( 'crypto' );
        let _input, _salt;

        /* Convert necessary data to Buffer objects. */
        if ( typeof input === 'object' ) {
            if ( Buffer.isBuffer( input ) )
                _input = input;
            else if ( Array.isArray )
                _input = Buffer.from( input );
            else
                _input = Buffer.from( input, is_input_hex === undefined ? 'utf8' : is_input_hex ? 'hex' : 'base64' );
        }
        else if ( typeof input === 'string' )
            _input = Buffer.from( input, 'utf8' );

        if ( typeof salt === 'object' ) {
            if ( Buffer.isBuffer( salt ) )
                _salt = salt;
            else if ( Array.isArray )
                _salt = Buffer.from( salt );
            else
                _salt = Buffer.from( salt, is_salt_hex === undefined ? 'utf8' : is_salt_hex ? 'hex' : 'base64' );
        }
        else if ( typeof salt === 'string' )
            _salt = Buffer.from( salt, 'utf8' );

        /* For function callbacks, use the async method else use the synchronous method. */
        if ( typeof callback === 'function' )
            crypto.pbkdf2( _input, _salt, iterations, key_length, algorithm, ( e, key ) => {
                callback( e, !e ? key.toString( to_hex ? 'hex' : 'base64' ) : '' );
            } );
        else
            try {
                return crypto.pbkdf2Sync( _input, _salt, iterations, key_length, algorithm )
                    .toString( to_hex ? 'hex' : 'base64' );
            }
            catch ( e ) {
                throw e;
            }
    }

    /**
     * @public
     * @desc Pads or un-pads the input message using the specified encoding format and block size.
     * @param {string|Buffer|Array} message The input message to either pad or unpad.
     * @param {string} padding_scheme The padding scheme used. This can be either: [ ISO1, ISO9, PKC7, ANS2 ]
     * @param {int} block_size The block size that the padding scheme must align the message to.
     * @param {boolean} [is_hex] Whether to treat the message as a hex or Base64 string.
     *      If undefined, it is interpreted as a UTF-8 string.
     * @param {boolean} [remove_padding] Whether to remove the padding applied to the message. If undefined, it is
     *      treated as false.
     * @returns {Buffer} Returns the padded or unpadded message as a Buffer object.
     */
    static __padMessage( message, padding_scheme, block_size, is_hex = undefined, remove_padding = undefined ) {
        let _message, _padBytes;

        /* Returns the number of bytes required to pad a message based on the block size. */
        function __getPaddingLength( totalLength, blockSize ) {
            return totalLength % blockSize === blockSize ? blockSize : blockSize - ( totalLength % blockSize );
        }

        /* Pads a message according to the PKCS #7 / PKCS #5 format. */
        function __PKCS7( message, paddingBytes, remove ) {
            if ( remove === undefined ) {
                /* Allocate required padding length + message length. */
                let padded = Buffer.alloc( message.length + paddingBytes );

                /* Copy the message. */
                message.copy( padded );

                /* Append the number of padding bytes according to PKCS #7 / PKCS #5 format. */
                Buffer.alloc( paddingBytes ).fill( paddingBytes ).copy( padded, message.length );

                /* Return the result. */
                return padded;
            }
            else {
                /* Remove the padding indicated by the last byte. */
                return message.slice( 0, message.length - message.readInt8( message.length - 1 ) );
            }
        }

        /* Pads a message according to the ANSI X9.23 format. */
        function __ANSIX923( message, paddingBytes, remove ) {
            if ( remove === undefined ) {
                /* Allocate required padding length + message length. */
                let padded = Buffer.alloc( message.length + paddingBytes );

                /* Copy the message. */
                message.copy( padded );

                /* Append null-bytes till the end of the message. */
                Buffer.alloc( paddingBytes - 1 ).fill( 0x00 ).copy( padded, message.length );

                /* Append the padding length as the final byte of the message. */
                Buffer.alloc( 1 ).fill( paddingBytes ).copy( padded, message.length + paddingBytes - 1 );

                /* Return the result. */
                return padded;
            }
            else {
                /* Remove the padding indicated by the last byte. */
                return message.slice( 0, message.length - message.readInt8( message.length - 1 ) );
            }
        }

        /* Pads a message according to the ISO 10126 format. */
        function __ISO10126( message, paddingBytes, remove ) {
            const crypto = require( 'crypto' );

            if ( remove === undefined ) {
                /* Allocate required padding length + message length. */
                let padded = Buffer.alloc( message.length + paddingBytes );

                /* Copy the message. */
                message.copy( padded );

                /* Copy random data to the end of the message. */
                crypto.randomBytes( paddingBytes - 1 ).copy( padded, message.length );

                /* Write the padding length at the last byte. */
                padded.writeUInt8( paddingBytes, message.length + paddingBytes - 1 );

                /* Return the result. */
                return padded;
            }
            else {
                /* Remove the padding indicated by the last byte. */
                return message.slice( 0, message.length - message.readUInt8( message.length - 1 ) );
            }
        }

        /* Pads a message according to the ISO 97971 format. */
        function __ISO97971( message, paddingBytes, remove ) {
            if ( remove === undefined ) {
                /* Allocate required padding length + message length. */
                let padded = Buffer.alloc( message.length + paddingBytes );

                /* Copy the message. */
                message.copy( padded );

                /* Append the first byte as 0x80 */
                Buffer.alloc( 1 ).fill( 0x80 ).copy( padded, message.length );

                /* Fill the rest of the padding with zeros. */
                Buffer.alloc( paddingBytes - 1 ).fill( 0x00 ).copy( message, message.length + 1 );

                /* Return the result. */
                return padded;
            }
            else {

                /* Scan backwards. */
                let lastIndex = message.length - 1;

                /* Find the amount of null padding bytes. */
                for ( ; lastIndex > 0; lastIndex-- )
                    /* If a null byte is encountered, split at this index. */
                    if ( message[ lastIndex ] !== 0x00 )
                        break;

                /* Remove the null-padding. */
                let cleaned = message.slice( 0, lastIndex + 1 );

                /* Remove the final byte which is 0x80. */
                return cleaned.slice( 0, cleaned.length - 1 );
            }
        }

        /* Convert the message to a Buffer object. */
        _message = discordCrypt.__toBuffer( message, is_hex );

        /* Get the number of bytes required to pad this message. */
        _padBytes = remove_padding ? 0 : __getPaddingLength( _message.length, block_size / 8 );

        /* Apply the message padding based on the format specified. */
        switch ( padding_scheme.toUpperCase() ) {
            case 'PKC7':
                return __PKCS7( _message, _padBytes, remove_padding );
            case 'ANS2':
                return __ANSIX923( _message, _padBytes, remove_padding );
            case 'ISO1':
                return __ISO10126( _message, _padBytes, remove_padding );
            case 'ISO9':
                return __ISO97971( _message, _padBytes, remove_padding );
            default:
                return '';
        }
    }

    /**
     * @public
     * @desc Determines whether the passed cipher name is valid.
     * @param {string} cipher The name of the cipher to check.
     * @returns {boolean} Returns true if the cipher name is valid.
     * @example
     * console.log( __isValidCipher( 'aes-256-cbc' ) ); // True
     * @example
     * console.log( __isValidCipher( 'aes-256-gcm' ) ); // True
     * @example
     * console.log( __isValidCipher( 'camellia-256-gcm' ) ); // False
     */
    static __isValidCipher( cipher ) {
        const crypto = require( 'crypto' );
        let isValid = false;

        /* Iterate all valid Crypto ciphers and compare the name. */
        let cipher_name = cipher.toLowerCase();
        crypto.getCiphers().every( ( s ) => {
            /* If the cipher matches, stop iterating. */
            if ( s === cipher_name ) {
                isValid = true;
                return false;
            }

            /* Continue iterating. */
            return true;
        } );

        /* Return the result. */
        return isValid;
    }

    /**
     * @public
     * @desc Converts a given key or iv into a buffer object. Performs a hash of the key it doesn't match the blockSize.
     * @param {string|Buffer|Array} key The key to perform validation on.
     * @param {int} key_size_bits The bit length of the desired key.
     * @param {boolean} [use_whirlpool] If the key length is 512-bits, use Whirlpool or SHA-512 hashing.
     * @returns {Buffer} Returns a Buffer() object containing the key of the desired length.
     */
    static __validateKeyIV( key, key_size_bits = 256, use_whirlpool = undefined ) {
        /* Get the designed hashing algorithm. */
        let keyBytes = key_size_bits / 8;

        /* If the length of the key isn't of the desired size, hash it. */
        if ( key.length !== keyBytes ) {
            let hash;

            /* Get the appropriate hasher for the key size. */
            switch ( keyBytes ) {
                case 8:
                    hash = discordCrypt.whirlpool64;
                    break;
                case 16:
                    hash = discordCrypt.sha512_128;
                    break;
                case 20:
                    hash = discordCrypt.sha160;
                    break;
                case 24:
                    hash = discordCrypt.whirlpool192;
                    break;
                case 32:
                    hash = discordCrypt.sha256;
                    break;
                case 64:
                    hash = use_whirlpool !== undefined ? discordCrypt.sha512 : discordCrypt.whirlpool;
                    break;
                default:
                    throw 'Invalid block size specified for key or iv. Only 64, 128, 160, 192, 256 and 512 bit keys' +
                    ' are supported.';
            }
            /* Hash the key and return it as a buffer. */
            return Buffer.from( hash( key, true ), 'hex' );
        }
        else
            return Buffer.from( key );
    }

    /**
     * @public
     * @desc Convert the message to a buffer object.
     * @param {string|Buffer|Array} message The input message.
     * @param {boolean} [is_message_hex] If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @returns {Buffer} Returns a Buffer() object containing the message.
     * @throws An exception indicating the input message type is neither an Array(), Buffer() or string.
     */
    static __validateMessage( message, is_message_hex = undefined ) {
        /* Convert the message to a buffer. */
        try {
            return discordCrypt.__toBuffer( message, is_message_hex );
        }
        catch ( e ) {
            throw 'exception - Invalid message type.';
        }
    }

    /**
     * @public
     * @desc Returns the string encoded mime type of a file based on the file extension.
     * @param {string} file_path The path to the file in question.
     * @returns {string} Returns the known file extension's MIME type or "application/octet-stream".
     */
    static __getFileMimeType( file_path ) {
        /* Look up the Mime type from the file extension. */
        let type = require( 'mime-types' ).lookup( require( 'path' ).extname( file_path ) );

        /* Default to an octet stream if it fails. */
        return type === false ? 'application/octet-stream' : type;
    }

    /**
     * @private
     * @desc Attempts to read the clipboard and converts either Images or text to raw Buffer() objects.
     * @returns {{ mime_type: string, name: string|null, data: Buffer|null }} Contains clipboard data. May be null.
     */
    static __clipboardToBuffer() {
        /* Request the clipboard object. */
        let clipboard = require( 'electron' ).clipboard;

        /* Sanity check. */
        if ( !clipboard )
            return { mime_type: '', name: '', data: null };

        /* We use original-fs to bypass any file-restrictions ( Eg. ASAR ) for reading. */
        let fs = require( 'original-fs' ),
            path = require( 'path' );

        /* The clipboard must have at least one type available. */
        if ( clipboard.availableFormats().length === 0 )
            return { mime_type: '', name: '', data: null };

        /* Get all available formats. */
        let mime_type = clipboard.availableFormats();
        let data, tmp = '', name = '', is_file = false;

        /* Loop over each format and try getting the data. */
        for ( let i = 0; i < mime_type.length; i++ ) {
            let format = mime_type[ i ].split( '/' );

            /* For types, prioritize images. */
            switch ( format[ 0 ] ) {
                case 'image':
                    /* Convert the image type. */
                    switch ( format[ 1 ].toLowerCase() ) {
                        case 'png':
                            data = clipboard.readImage().toPNG();
                            break;
                        case 'bmp':
                        case 'bitmap':
                            data = clipboard.readImage().toBitmap();
                            break;
                        case 'jpg':
                        case 'jpeg':
                            data = clipboard.readImage().toJPEG( 100 );
                            break;
                        default:
                            break;
                    }
                    break;
                case 'text':
                    tmp = clipboard.readText();

                    /* For text, see if this is a file path. */
                    if ( fs.existsSync( tmp ) ) {
                        /* Read the file and store the file name. */
                        data = fs.readFileSync( tmp );
                        name = path.basename( tmp );
                        is_file = true;
                    }
                    else {
                        /* Convert the text to a buffer. */
                        data = Buffer.from( tmp, 'utf8' );
                    }
                    break;
                default:
                    break;
            }

            /* Keep trying till it has at least a byte of data to return. */
            if ( data && data.length > 0 ) {
                /* If this is a file, try getting the file's MIME type. */
                if ( is_file )
                    mime_type[ i ] = discordCrypt.__getFileMimeType( tmp );

                /* Return the data. */
                return {
                    mime_type: mime_type[ i ],
                    name: name,
                    data: data
                }
            }
        }

        return { mime_type: '', name: '', data: null };
    }

    /**
     * @callback encryptedFileCallback
     * @param {string} error_string The error that occurred during operation or null if no error occurred.
     * @param {Buffer} encrypted_data The resulting encrypted buffer as a Buffer() object.
     * @param {string} identity The encoded identity of the encrypted file.
     * @param {string} seed The initial seed used to decrypt the encryption keys of the file.
     */

    /**
     * @public
     * @desc Uploads the specified buffer to Up1's format specifications and returns this data to the callback.
     * @param {Buffer} data The input buffer to encrypt.
     * @param {string} mime_type The MIME type of this file.
     * @param {string} file_name The name of this file.
     * @param {Object} sjcl The loaded Stanford Javascript Crypto Library.
     * @param {encryptedFileCallback} callback The callback function that will be called on error or completion.
     */
    static __up1EncryptBuffer( data, mime_type, file_name, sjcl, callback ) {
        const crypto = require( 'crypto' );

        /* Returns a parameter object from the input seed. */
        function getParams( /* string|Buffer|Array|Uint8Array */ seed ) {
            /* Convert the seed either from a string to Base64 or read it via raw bytes. */
            if ( typeof seed === 'string' )
                seed = sjcl.codec.base64url.toBits( seed );
            else
                seed = sjcl.codec.bytes.toBits( seed );

            /* Compute an SHA-512 hash. */
            let out = sjcl.hash.sha512.hash( seed );

            /* Calculate the output values based on Up1's specs. */
            return {
                seed: seed,
                key: sjcl.bitArray.bitSlice( out, 0, 256 ),
                iv: sjcl.bitArray.bitSlice( out, 256, 384 ),
                ident: sjcl.bitArray.bitSlice( out, 384, 512 )
            }
        }

        /* Converts a string to its UTF-16 equivalent in network byte order. */
        function str2ab( /* string */ str ) {
            /* UTF-16 requires 2 bytes per UTF-8 byte. */
            let buf = Buffer.alloc( str.length * 2 );

            /* Loop over each byte. */
            for ( let i = 0, strLen = str.length; i < strLen; i++ ) {
                /* Write the UTF-16 equivalent in Big Endian. */
                buf.writeUInt16BE( str.charCodeAt( i ), i * 2 );
            }

            return buf;
        }

        try {
            /* Make sure the file size is less than 50 MB. */
            if ( data.length > 50000000 ) {
                callback( 'Input size must be < 50 MB.' );
                return;
            }

            /* Calculate the upload header and append the file data to it prior to encryption. */
            data = Buffer.concat( [
                str2ab( JSON.stringify( { 'mime': mime_type, 'name': file_name } ) ),
                Buffer.from( [ 0, 0 ] ),
                data
            ] );

            /* Convert the file to a Uint8Array() then to SJCL's bit buffer. */
            data = sjcl.codec.bytes.toBits( new Uint8Array( data ) );

            /* Generate a random 128 bit seed and calculate the key and IV from this. */
            let params = getParams( crypto.randomBytes( 16 ) );

            /* Perform AES-256-CCM encryption on this buffer and return an ArrayBuffer() object. */
            data = sjcl.arrayBuffer.ccm.compat_encrypt( new sjcl.cipher.aes( params.key ), data, params.iv );

            /* Execute the callback. */
            callback(
                null,
                Buffer.from( sjcl.codec.bytes.fromBits( data ) ),
                sjcl.codec.base64url.fromBits( params.ident ),
                sjcl.codec.base64url.fromBits( params.seed )
            );
        }
        catch ( ex ) {
            callback( ex.toString() );
        }
    }

    /**
     * @private
     * @desc Performs AES-256 CCM encryption of the given file and converts it to the expected Up1 format.
     * @param {string} file_path The path to the file to encrypt.
     * @param {Object} sjcl The loaded SJCL library providing AES-256 CCM.
     * @param {encryptedFileCallback} callback The callback function for when the file has been encrypted.
     * @param {boolean} [randomize_file_name] Whether to randomize the name of the file in the metadata. Default: False.
     */
    static __up1EncryptFile( file_path, sjcl, callback, randomize_file_name = false ) {
        const crypto = require( 'crypto' );
        const path = require( 'path' );
        const fs = require( 'original-fs' );

        try {
            /* Make sure the file size is less than 50 MB. */
            if ( fs.statSync( file_path ).size > 50000000 ) {
                callback( 'File size must be < 50 MB.' );
                return;
            }

            /* Read the file in an async callback. */
            fs.readFile( file_path, ( error, file_data ) => {
                /* Check for any errors. */
                if ( error !== null ) {
                    callback( error.toString() );
                    return;
                }

                /* Encrypt the file data. */
                discordCrypt.__up1EncryptBuffer(
                    file_data,
                    discordCrypt.__getFileMimeType( file_path ),
                    randomize_file_name ?
                        crypto.pseudoRandomBytes( 8 ).toString( 'hex' ) + path.extname( file_path ) :
                        path.basename( file_path ),
                    sjcl,
                    callback
                )
            } );
        }
        catch ( ex ) {
            callback( ex.toString() );
        }
    }

    /**
     * @callback uploadedFileCallback
     * @param {string} error_string The error that occurred or null if no error occurred.
     * @param {string} file_url The URL of the uploaded file/
     * @param {string} deletion_link The link used to delete the file.
     * @param {string} encoded_seed The encoded encryption key used to decrypt the file.
     */

    /**
     * @public
     * @desc Uploads raw data to an Up1 service and returns the file URL and deletion key.
     * @param {string} up1_host The host URL for the Up1 service.
     * @param {string} [up1_api_key] The optional API key used for the service.
     * @param {Object} sjcl The loaded SJCL library providing AES-256 CCM.
     * @param {uploadedFileCallback} callback The callback function called on success or failure.
     * @param {{ mime_type: string, name: string|null, data: Buffer|null }} [clipboard_data] Optional clipboard data.
     */
    static __up1UploadClipboard( up1_host, up1_api_key, sjcl, callback, clipboard_data = undefined ) {
        /* Get the current clipboard data. */
        let clipboard = clipboard_data === undefined ? discordCrypt.__clipboardToBuffer() : clipboard_data;

        /* Perform sanity checks on the clipboard data. */
        if ( !clipboard.mime_type.length || clipboard.data === null ) {
            callback( 'Invalid clipboard data.' );
            return;
        }

        /* Get a real file name, whether it be random or actual. */
        let file_name = clipboard.name.length === 0 ?
            require( 'crypto' ).pseudoRandomBytes( 16 ).toString( 'hex' ) :
            clipboard.name;

        /* Encrypt the buffer. */
        this.__up1EncryptBuffer(
            clipboard.data,
            clipboard.mime_type,
            file_name,
            sjcl,
            ( error_string, encrypted_data, identity, encoded_seed ) => {
                /* Return if there's an error. */
                if ( error_string !== null ) {
                    callback( error_string );
                    return;
                }

                /* Create a new FormData() object. */
                let form = new ( require( 'form-data' ) )();

                /* Append the ID and the file data to it. */
                form.append( 'ident', identity );
                form.append( 'file', encrypted_data, { filename: 'file', contentType: 'text/plain' } );

                /* Append the API key if necessary. */
                if ( up1_api_key !== undefined && typeof up1_api_key === 'string' )
                    form.append( 'api_key', up1_api_key );

                /* Perform the post request. */
                require( 'request' ).post( {
                        headers: form.getHeaders(),
                        uri: `${up1_host}/up`,
                        body: form
                    },
                    ( err, res, body ) => {
                        try {
                            /* Execute the callback if no error has occurred. */
                            if ( err !== null )
                                callback( err );
                            else {
                                callback(
                                    null,
                                    `${up1_host}/#${encoded_seed}`,
                                    `${up1_host}/del?ident=${identity}&delkey=${JSON.parse( body ).delkey}`,
                                    encoded_seed
                                );
                            }
                        }
                        catch ( ex ) {
                            callback( ex.toString() );
                        }
                    }
                );
            }
        );
    }

    /**
     * @public
     * @desc Uploads the given file path to an Up1 service and returns the file URL and deletion key.
     * @param {string} file_path The path to the file to encrypt.
     * @param {string} up1_host The host URL for the Up1 service.
     * @param {string} [up1_api_key] The optional API key used for the service.
     * @param {Object} sjcl The loaded SJCL library providing AES-256 CCM.
     * @param {uploadedFileCallback} callback The callback function called on success or failure.
     * @param {boolean} [randomize_file_name] Whether to randomize the name of the file in the metadata. Default: False.
     */
    static __up1UploadFile( file_path, up1_host, up1_api_key, sjcl, callback, randomize_file_name = false ) {
        /* Encrypt the file data first. */
        this.__up1EncryptFile(
            file_path,
            sjcl,
            ( error_string, encrypted_data, identity, encoded_seed ) => {
                /* Return if there's an error. */
                if ( error_string !== null ) {
                    callback( error_string );
                    return;
                }

                /* Create a new FormData() object. */
                let form = new ( require( 'form-data' ) )();

                /* Append the ID and the file data to it. */
                form.append( 'ident', identity );
                form.append( 'file', encrypted_data, { filename: 'file', contentType: 'text/plain' } );

                /* Append the API key if necessary. */
                if ( up1_api_key !== undefined && typeof up1_api_key === 'string' )
                    form.append( 'api_key', up1_api_key );

                /* Perform the post request. */
                require( 'request' ).post( {
                        headers: form.getHeaders(),
                        uri: `${up1_host}/up`,
                        body: form
                    },
                    ( err, res, body ) => {
                        try {
                            /* Execute the callback if no error has occurred. */
                            if ( err !== null )
                                callback( err );
                            else {
                                callback(
                                    null,
                                    `${up1_host}/#${encoded_seed}`,
                                    `${up1_host}/del?ident=${identity}&delkey=${JSON.parse( body ).delkey}`,
                                    encoded_seed
                                );
                            }
                        }
                        catch ( ex ) {
                            callback( ex.toString() );
                        }
                    }
                );
            },
            randomize_file_name
        );
    }

    /* ========================================================= */

    /* ============== NODE CRYPTO HASH PRIMITIVES ============== */

    /**
     * @callback scryptCallback
     * @desc Callback must return false repeatedly upon each call to have Scrypt continue running.
     *      Once [progress] === 1.f AND [key] is defined, no further calls will be made.
     * @param {string} error The error message encountered or null.
     * @param {real} progress The percentage of the operation completed. This ranges from [ 0.00 - 1.00 ].
     * @param {Buffer} result The output result when completed or null if not completed.
     * @returns Returns false if the operation is to continue running or true if the cancel the running operation.
     */

    /**
     * @public
     * @desc Performs the Scrypt hash function on the given input.
     *      Original Implementation: https://github.com/ricmoo/scrypt-js
     * @param {string|Buffer|Array} input The input data to hash.
     * @param {string|Buffer|Array} salt The unique salt used for hashing.
     * @param {int} dkLen The desired length of the output in bytes.
     * @param {int} N The work factor variable. Memory and CPU usage scale linearly with this.
     * @param {int} r Increases the size of each hash produced by a factor of 2rK-bits.
     * @param {int} p Parallel factor. Indicates the number of mixing functions to be run simultaneously.
     * @param {scryptCallback} cb Callback function for progress updates.
     * @returns {boolean} Returns true if successful.
     */
    static scrypt( input, salt, dkLen, N = 16384, r = 8, p = 1, cb = null ) {
        let _in, _salt;

        /* PBKDF2-HMAC-SHA256 Helper. */
        function PBKDF2_SHA256( input, salt, size, iterations ) {
            try {
                return Buffer.from(
                    discordCrypt.pbkdf2_sha256( input, salt, true, undefined, undefined, size, iterations ),
                    'hex'
                );
            }
            catch ( e ) {
                discordCrypt.log( e.toString(), 'error' );
                return Buffer.alloc( 1 );
            }
        }

        /**
         * @private
         * @desc Mixes a block and performs SALSA20 on it.
         * @param {Uint32Array} BY
         * @param {int} Yi
         * @param {int} r
         * @param {Uint32Array} x
         * @param {Uint32Array} _X
         */
        function Salsa20_BlockMix( BY, Yi, r, x, _X ) {
            let i, j, k, l;

            for ( i = 0, j = ( 2 * r - 1 ) * 16; i < 16; i++ )
                _X[ i ] = BY[ j + i ];

            for ( i = 0; i < 2 * r; i++ ) {
                for ( j = 0, k = i * 16; j < 16; j++ )
                    _X[ j ] ^= BY[ k + j ];

                for ( j = 0; j < 16; j++ )
                    x[ j ] = _X[ j ];

                /**
                 * @desc Rotates [a] by [b] bits to the left.
                 * @param {int} a The base value.
                 * @param {int} b The number of bits to rotate [a] to the left by.
                 * @return {number}
                 */
                let R = ( a, b ) => {
                    return ( a << b ) | ( a >>> ( 32 - b ) );
                };

                for ( j = 8; j > 0; j -= 2 ) {
                    x[ 0x04 ] ^= R( x[ 0x00 ] + x[ 0x0C ], 0x07 );
                    x[ 0x08 ] ^= R( x[ 0x04 ] + x[ 0x00 ], 0x09 );
                    x[ 0x0C ] ^= R( x[ 0x08 ] + x[ 0x04 ], 0x0D );
                    x[ 0x00 ] ^= R( x[ 0x0C ] + x[ 0x08 ], 0x12 );
                    x[ 0x09 ] ^= R( x[ 0x05 ] + x[ 0x01 ], 0x07 );
                    x[ 0x0D ] ^= R( x[ 0x09 ] + x[ 0x05 ], 0x09 );
                    x[ 0x01 ] ^= R( x[ 0x0D ] + x[ 0x09 ], 0x0D );
                    x[ 0x05 ] ^= R( x[ 0x01 ] + x[ 0x0D ], 0x12 );
                    x[ 0x0E ] ^= R( x[ 0x0A ] + x[ 0x06 ], 0x07 );
                    x[ 0x02 ] ^= R( x[ 0x0E ] + x[ 0x0A ], 0x09 );
                    x[ 0x06 ] ^= R( x[ 0x02 ] + x[ 0x0E ], 0x0D );
                    x[ 0x0A ] ^= R( x[ 0x06 ] + x[ 0x02 ], 0x12 );
                    x[ 0x03 ] ^= R( x[ 0x0F ] + x[ 0x0B ], 0x07 );
                    x[ 0x07 ] ^= R( x[ 0x03 ] + x[ 0x0F ], 0x09 );
                    x[ 0x0B ] ^= R( x[ 0x07 ] + x[ 0x03 ], 0x0D );
                    x[ 0x0F ] ^= R( x[ 0x0B ] + x[ 0x07 ], 0x12 );
                    x[ 0x01 ] ^= R( x[ 0x00 ] + x[ 0x03 ], 0x07 );
                    x[ 0x02 ] ^= R( x[ 0x01 ] + x[ 0x00 ], 0x09 );
                    x[ 0x03 ] ^= R( x[ 0x02 ] + x[ 0x01 ], 0x0D );
                    x[ 0x00 ] ^= R( x[ 0x03 ] + x[ 0x02 ], 0x12 );
                    x[ 0x06 ] ^= R( x[ 0x05 ] + x[ 0x04 ], 0x07 );
                    x[ 0x07 ] ^= R( x[ 0x06 ] + x[ 0x05 ], 0x09 );
                    x[ 0x04 ] ^= R( x[ 0x07 ] + x[ 0x06 ], 0x0D );
                    x[ 0x05 ] ^= R( x[ 0x04 ] + x[ 0x07 ], 0x12 );
                    x[ 0x0B ] ^= R( x[ 0x0A ] + x[ 0x09 ], 0x07 );
                    x[ 0x08 ] ^= R( x[ 0x0B ] + x[ 0x0A ], 0x09 );
                    x[ 0x09 ] ^= R( x[ 0x08 ] + x[ 0x0B ], 0x0D );
                    x[ 0x0A ] ^= R( x[ 0x09 ] + x[ 0x08 ], 0x12 );
                    x[ 0x0C ] ^= R( x[ 0x0F ] + x[ 0x0E ], 0x07 );
                    x[ 0x0D ] ^= R( x[ 0x0C ] + x[ 0x0F ], 0x09 );
                    x[ 0x0E ] ^= R( x[ 0x0D ] + x[ 0x0C ], 0x0D );
                    x[ 0x0F ] ^= R( x[ 0x0E ] + x[ 0x0D ], 0x12 );
                }

                for ( j = 0; j < 16; ++j )
                    _X[ j ] += x[ j ];

                /* Copy back the result. */
                for ( j = 0, k = Yi + ( i * 16 ); j < 16; j++ )
                    BY[ j + k ] = _X[ j ];
            }

            for ( i = 0; i < r; i++ ) {
                for ( j = 0, k = Yi + ( i * 2 ) * 16, l = ( i * 16 ); j < 16; j++ )
                    BY[ l + j ] = BY[ k + j ];
            }

            for ( i = 0; i < r; i++ ) {
                for ( j = 0, k = Yi + ( i * 2 + 1 ) * 16, l = ( i + r ) * 16; j < 16; j++ )
                    BY[ l + j ] = BY[ k + j ];
            }
        }

        /**
         * @desc Perform the scrypt process in steps and call the callback on intervals.
         * @param {string|Buffer|Array} input The input data to hash.
         * @param {string|Buffer|Array} salt The unique salt used for hashing.
         * @param {int} N The work factor variable. Memory and CPU usage scale linearly with this.
         * @param {int} r Increases the size of each hash produced by a factor of 2rK-bits.
         * @param {int} p Parallel factor. Indicates the number of mixing functions to be run simultaneously.
         * @param {scryptCallback} cb Callback function for progress updates.
         * @private
         */
        function __perform( input, salt, N, r, p, cb ) {
            let totalOps, currentOps, lastPercentage;
            let b = PBKDF2_SHA256( input, salt, p * 128 * r, 1 );
            let B = new Uint32Array( p * 32 * r );

            /* Initialize the input. */
            for ( let i = 0; i < B.length; i++ ) {
                let j = i * 4;
                B[ i ] =
                    ( ( b[ j + 3 ] & 0xff ) << 24 ) |
                    ( ( b[ j + 2 ] & 0xff ) << 16 ) |
                    ( ( b[ j + 1 ] & 0xff ) << 8 ) |
                    ( ( b[ j ] & 0xff ) << 0 );
            }

            let XY = new Uint32Array( 64 * r );
            let V = new Uint32Array( 32 * r * N );

            let Yi = 32 * r;

            /* Salsa20 Scratchpad. */
            let x = new Uint32Array( 16 );
            /* Block-mix Salsa20 Scratchpad. */
            let _X = new Uint32Array( 16 );

            totalOps = p * N * 2;
            currentOps = 0;
            lastPercentage = null;

            /* Set this to true to abandon the scrypt on the next step. */
            let stop = false;

            /* State information. */
            let state = 0, stateCount = 0, i1;
            let Bi;

            /* How many block-mix salsa8 operations can we do per step? */
            let limit = parseInt( 1000 / r );

            /* Trick from scrypt-async; if there is a setImmediate shim in place, use it. */
            let nextTick = ( typeof( setImmediate ) !== 'undefined' ) ? setImmediate : setTimeout;

            const incrementalSMix = function () {
                if ( stop )
                    return cb( new Error( 'cancelled' ), currentOps / totalOps );

                let steps, i, y, z, currentPercentage;
                switch ( state ) {
                    case 0:
                        Bi = stateCount * 32 * r;
                        /* Row mix #1 */
                        for ( let z = 0; z < Yi; z++ )
                            XY[ z ] = B[ Bi + z ]

                        /* Move to second row mix. */
                        state = 1;
                        i1 = 0;
                    /* Fall through purposely. */
                    case 1:
                        /* Run up to 1000 steps of the first inner S-Mix loop. */
                        steps = N - i1;

                        if ( steps > limit )
                            steps = limit;

                        /* Row mix #2 */
                        for ( i = 0; i < steps; i++ ) {
                            /* Row mix #3 */
                            y = ( i1 + i ) * Yi;
                            z = Yi;
                            while ( z-- ) V[ z + y ] = XY[ z ];

                            /* Row mix #4 */
                            Salsa20_BlockMix( XY, Yi, r, x, _X );
                        }

                        i1 += steps;
                        currentOps += steps;

                        /* Call the callback with the progress. ( Optionally stopping us. ) */
                        currentPercentage = parseInt( 1000 * currentOps / totalOps );
                        if ( currentPercentage !== lastPercentage ) {
                            stop = cb( null, currentOps / totalOps );

                            if ( stop )
                                break;

                            lastPercentage = currentPercentage;
                        }

                        if ( i1 < N )
                            break;

                        /* Row mix #6 */
                        i1 = 0;
                        state = 2;
                    /* Fall through purposely. */
                    case 2:

                        /* Run up to 1000 steps of the second inner S-Mix loop. */
                        steps = N - i1;

                        if ( steps > limit )
                            steps = limit;

                        for ( i = 0; i < steps; i++ ) {
                            /* Row mix #8 ( inner ) */
                            for ( z = 0, y = ( XY[ ( 2 * r - 1 ) * 16 ] & ( N - 1 ) ) * Yi; z < Yi; z++ )
                                XY[ z ] ^= V[ y + z ];
                            /* Row mix #9 ( outer ) */
                            Salsa20_BlockMix( XY, Yi, r, x, _X );
                        }

                        i1 += steps;
                        currentOps += steps;

                        /* Call the callback with the progress. ( Optionally stopping us. ) */
                        currentPercentage = parseInt( 1000 * currentOps / totalOps );
                        if ( currentPercentage !== lastPercentage ) {
                            stop = cb( null, currentOps / totalOps );

                            if ( stop )
                                break;

                            lastPercentage = currentPercentage;
                        }

                        if ( i1 < N )
                            break;

                        /* Row mix #10 */
                        for ( z = 0; z < Yi; z++ )
                            B[ Bi + z ] = XY[ z ];

                        stateCount++;
                        if ( stateCount < p ) {
                            state = 0;
                            break;
                        }

                        b = [];
                        for ( i = 0; i < B.length; i++ ) {
                            b.push( ( B[ i ] >> 0 ) & 0xff );
                            b.push( ( B[ i ] >> 8 ) & 0xff );
                            b.push( ( B[ i ] >> 16 ) & 0xff );
                            b.push( ( B[ i ] >> 24 ) & 0xff );
                        }

                        /* Done. Don't break to avoid rescheduling. */
                        return cb( null, 1.0, Buffer.from( PBKDF2_SHA256( input, Buffer.from( b ), dkLen, 1 ) ) );
                    default:
                        return cb( new Error( 'invalid state' ), 0 );
                }

                /* Schedule the next steps. */
                nextTick( incrementalSMix );
            };

            incrementalSMix();
        }

        /* Validate input. */
        if ( typeof input === 'object' || typeof input === 'string' ) {
            if ( Array.isArray( input ) )
                _in = Buffer.from( input );
            else if ( Buffer.isBuffer( input ) )
                _in = input;
            else if ( typeof input === 'string' )
                _in = Buffer.from( input, 'utf8' );
            else {
                discordCrypt.log( 'Invalid input parameter type specified!', 'error' );
                return false;
            }
        }

        /* Validate salt. */
        if ( typeof salt === 'object' || typeof salt === 'string' ) {
            if ( Array.isArray( salt ) )
                _salt = Buffer.from( salt );
            else if ( Buffer.isBuffer( salt ) )
                _salt = salt;
            else if ( typeof salt === 'string' )
                _salt = Buffer.from( salt, 'utf8' );
            else {
                discordCrypt.log( 'Invalid salt parameter type specified!', 'error' );
                return false;
            }
        }

        /* Validate derived key length. */
        if ( typeof dkLen !== 'number' ) {
            discordCrypt.log( 'Invalid dkLen parameter specified. Must be a numeric value.', 'error' );
            return false;
        }
        else if ( dkLen <= 0 || dkLen >= 65536 ) {
            discordCrypt.log( 'Invalid dkLen parameter specified. Must be a numeric value.', 'error' );
            return false;
        }

        /* Validate N is a power of 2. */
        if ( !N || N & ( N - 1 ) !== 0 ) {
            discordCrypt.log( 'Parameter N must be a power of 2.', 'error' );
            return false;
        }

        /* Perform a non-blocking . */
        if ( cb !== undefined && cb !== null ) {
            setTimeout( () => {
                __perform( _in, _salt, N, r, p, cb );
            }, 1 );
            return true;
        }

        /* Signal an error. */
        discordCrypt.log( 'No callback specified.', 'error' );
        return false;
    }

    /**
     * @public
     * @desc Returns the first 64 bits of a Whirlpool digest of the message.
     * @param {Buffer|Array|string} message The input message to hash.
     * @param {boolean} to_hex Whether to convert the result to hex or Base64.
     * @returns {string} Returns the hex or Base64 encoded result.
     */
    static whirlpool64( message, to_hex ) {
        return Buffer.from( discordCrypt.whirlpool( message, true ), 'hex' )
            .slice( 0, 8 ).toString( to_hex ? 'hex' : 'base64' );
    }

    /**
     * @public
     * @desc Returns the first 128 bits of an SHA-512 digest of a message.
     * @param {Buffer|Array|string} message The input message to hash.
     * @param {boolean} to_hex Whether to convert the result to hex or Base64.
     * @returns {string} Returns the hex or Base64 encoded result.
     */
    static sha512_128( message, to_hex ) {
        return Buffer.from( discordCrypt.sha512( message, true ), 'hex' )
            .slice( 0, 16 ).toString( to_hex ? 'hex' : 'base64' );
    }

    /**
     * @public
     * @desc Returns the first 192 bits of a Whirlpool digest of the message.
     * @param {Buffer|Array|string} message The input message to hash.
     * @param {boolean} to_hex Whether to convert the result to hex or Base64.
     * @returns {string} Returns the hex or Base64 encoded result.
     */
    static whirlpool192( message, to_hex ) {
        return Buffer.from( discordCrypt.sha512( message, true ), 'hex' )
            .slice( 0, 24 ).toString( to_hex ? 'hex' : 'base64' );
    }

    /**
     * @public
     * @desc Returns an SHA-160 digest of the message.
     * @param {Buffer|Array|string} message The input message to hash.
     * @param {boolean} to_hex Whether to convert the result to hex or Base64.
     * @returns {string} Returns the hex or Base64 encoded result.
     */
    static sha160( message, to_hex ) {
        return discordCrypt.__createHash( message, 'sha1', to_hex );
    }

    /**
     * @public
     * @desc Returns an SHA-256 digest of the message.
     * @param {Buffer|Array|string} message The input message to hash.
     * @param {boolean} to_hex Whether to convert the result to hex or Base64.
     * @returns {string} Returns the hex or Base64 encoded result.
     */
    static sha256( message, to_hex ) {
        return discordCrypt.__createHash( message, 'sha256', to_hex );
    }

    /**
     * @public
     * @desc Returns an SHA-512 digest of the message.
     * @param {Buffer|Array|string} message The input message to hash.
     * @param {boolean} to_hex Whether to convert the result to hex or Base64.
     * @returns {string} Returns the hex or Base64 encoded result.
     */
    static sha512( message, to_hex ) {
        return discordCrypt.__createHash( message, 'sha512', to_hex );
    }

    /**
     * @public
     * @desc Returns a Whirlpool-512 digest of the message.
     * @param {Buffer|Array|string} message The input message to hash.
     * @param {boolean} to_hex Whether to convert the result to hex or Base64.
     * @returns {string} Returns the hex or Base64 encoded result.
     */
    static whirlpool( message, to_hex ) {
        return discordCrypt.__createHash( message, 'whirlpool', to_hex );
    }

    /**
     * @public
     * @desc Returns a HMAC-SHA-256 digest of the message.
     * @param {Buffer|Array|string} message The input message to hash.
     * @param {Buffer|Array|string} secret The secret input used with the message.
     * @param {boolean} to_hex Whether to convert the result to hex or Base64.
     * @returns {string} Returns the hex or Base64 encoded result.
     */
    static hmac_sha256( message, secret, to_hex ) {
        return discordCrypt.__createHash( message, 'sha256', to_hex, true, secret );
    }

    /*  */
    /**
     * @public
     * @desc Returns an HMAC-SHA-512 digest of the message.
     * @param {Buffer|Array|string} message The input message to hash.
     * @param {Buffer|Array|string} secret The secret input used with the message.
     * @param {boolean} to_hex Whether to convert the result to hex or Base64.
     * @returns {string} Returns the hex or Base64 encoded result.
     */
    static hmac_sha512( message, secret, to_hex ) {
        return discordCrypt.__createHash( message, 'sha512', to_hex, true, secret );
    }

    /**
     * @public
     * @desc Returns an HMAC-Whirlpool-512 digest of the message.
     * @param {Buffer|Array|string} message The input message to hash.
     * @param {Buffer|Array|string} secret The secret input used with the message.
     * @param {boolean} to_hex Whether to convert the result to hex or Base64.
     * @returns {string} Returns the hex or Base64 encoded result.
     */
    static hmac_whirlpool( message, secret, to_hex ) {
        return discordCrypt.__createHash( message, 'whirlpool', to_hex, true, secret );
    }

    /**
     * @callback hashCallback
     * @param {string} error The error that occurred or null.
     * @param {string} hash The hex or Base64 encoded result.
     */

    /**
     * @public
     * @desc Computes a derived digest using the PBKDF2 algorithm and SHA-160 as primitives.
     * @param {Buffer|Array|string} message The input message to hash.
     * @param {Buffer|Array|string} salt The random salting input used with the message.
     * @param {boolean} to_hex Whether to convert the result to hex or Base64.
     * @param {boolean} [message_is_hex] Whether to treat the message as a hex or Base64 string.
     *      If undefined, it is interpreted as a UTF-8 string.
     * @param {boolean} [salt_is_hex] Whether to treat the salt as a hex or Base64 string.
     *      If undefined, it is interpreted as a UTF-8 string.
     * @param {int} [key_length] The desired key length size in bytes. Default: 32.
     * @param {int} [iterations] The number of iterations to perform. Default: 5000.
     * @param {hashCallback} [callback] If defined, an async call is made that the result is passed to this when
     *      completed. If undefined, a sync call is made instead.
     * @returns {string|null} If a callback is defined, this returns nothing else it returns either a Base64 or hex
     *      encoded result.
     */
    static pbkdf2_sha160(
        message,
        salt,
        to_hex,
        message_is_hex = undefined,
        salt_is_hex = undefined,
        key_length = 32,
        iterations = 5000,
        callback = undefined
    ) {
        return discordCrypt.__pbkdf2(
            message,
            salt,
            to_hex,
            message_is_hex,
            salt_is_hex,
            callback,
            'sha1',
            key_length,
            iterations
        );
    }

    /**
     * @public
     * @desc Computes a derived digest using the PBKDF2 algorithm and SHA-256 as primitives.
     * @param {Buffer|Array|string} message The input message to hash.
     * @param {Buffer|Array|string} salt The random salting input used with the message.
     * @param {boolean} to_hex Whether to convert the result to hex or Base64.
     * @param {boolean} [message_is_hex] Whether to treat the message as a hex or Base64 string.
     *      If undefined, it is interpreted as a UTF-8 string.
     * @param {boolean} [salt_is_hex] Whether to treat the salt as a hex or Base64 string.
     *      If undefined, it is interpreted as a UTF-8 string.
     * @param {int} [key_length] The desired key length size in bytes. Default: 32.
     * @param {int} [iterations] The number of iterations to perform. Default: 5000.
     * @param {hashCallback} [callback] If defined, an async call is made that the result is passed to this when
     *      completed. If undefined, a sync call is made instead.
     * @returns {string|null} If a callback is defined, this returns nothing else it returns either a Base64 or hex
     *      encoded result.
     */
    static pbkdf2_sha256(
        message,
        salt,
        to_hex,
        message_is_hex = undefined,
        salt_is_hex = undefined,
        key_length = 32,
        iterations = 5000,
        callback = undefined
    ) {
        return discordCrypt.__pbkdf2(
            message,
            salt,
            to_hex,
            message_is_hex,
            salt_is_hex,
            callback,
            'sha256',
            key_length,
            iterations
        );
    }

    /**
     * @public
     * @desc Computes a derived digest using the PBKDF2 algorithm and SHA-512 as primitives.
     * @param {Buffer|Array|string} message The input message to hash.
     * @param {Buffer|Array|string} salt The random salting input used with the message.
     * @param {boolean} to_hex Whether to convert the result to hex or Base64.
     * @param {boolean} [message_is_hex] Whether to treat the message as a hex or Base64 string.
     *      If undefined, it is interpreted as a UTF-8 string.
     * @param {boolean} [salt_is_hex] Whether to treat the salt as a hex or Base64 string.
     *      If undefined, it is interpreted as a UTF-8 string.
     * @param {int} [key_length] The desired key length size in bytes. Default: 32.
     * @param {int} [iterations] The number of iterations to perform. Default: 5000.
     * @param {hashCallback} [callback] If defined, an async call is made that the result is passed to this when
     *      completed. If undefined, a sync call is made instead.
     * @returns {string|null} If a callback is defined, this returns nothing else it returns either a Base64 or hex
     *      encoded result.
     */
    static pbkdf2_sha512(
        /* Buffer|Array|string */   message,
        /* Buffer|Array|string */   salt,
        /* boolean */               to_hex,
        /* boolean */               message_is_hex = undefined,
        /* boolean */               salt_is_hex = undefined,
        /* int */                   key_length = 32,
        /* int */                   iterations = 5000,
        /* function(err, hash) */   callback = undefined
    ) {
        return discordCrypt.__pbkdf2(
            message,
            salt,
            to_hex,
            message_is_hex,
            salt_is_hex,
            callback,
            'sha512',
            key_length,
            iterations
        );
    }

    /**
     * @public
     * @desc Computes a derived digest using the PBKDF2 algorithm and Whirlpool-512 as primitives.
     * @param {Buffer|Array|string} message The input message to hash.
     * @param {Buffer|Array|string} salt The random salting input used with the message.
     * @param {boolean} to_hex Whether to convert the result to hex or Base64.
     * @param {boolean} [message_is_hex] Whether to treat the message as a hex or Base64 string.
     *      If undefined, it is interpreted as a UTF-8 string.
     * @param {boolean} [salt_is_hex] Whether to treat the salt as a hex or Base64 string.
     *      If undefined, it is interpreted as a UTF-8 string.
     * @param {int} [key_length] The desired key length size in bytes. Default: 32.
     * @param {int} [iterations] The number of iterations to perform. Default: 5000.
     * @param {hashCallback} [callback] If defined, an async call is made that the result is passed to this when
     *      completed. If undefined, a sync call is made instead.
     * @returns {string|null} If a callback is defined, this returns nothing else it returns either a Base64 or hex
     *      encoded result.
     */
    static pbkdf2_whirlpool(
        message,
        salt,
        to_hex,
        message_is_hex = undefined,
        salt_is_hex = undefined,
        key_length = 32,
        iterations = 5000,
        callback = undefined
    ) {
        return discordCrypt.__pbkdf2(
            message,
            salt,
            to_hex,
            message_is_hex,
            salt_is_hex,
            callback,
            'whirlpool',
            key_length,
            iterations
        );
    }

    /* ============ END NODE CRYPTO HASH PRIMITIVES ============ */

    /* ================ CRYPTO CIPHER FUNCTIONS ================ */

    /**
     * @public
     * @desc Encrypts the given plain-text message using the algorithm specified.
     * @param {string} symmetric_cipher The name of the symmetric cipher used to encrypt the message.
     *      This must be supported by NodeJS's crypto module.
     * @param {string} block_mode The block operation mode of the cipher.
     *      This can be either [ 'CBC', 'CFB', 'OFB' ].
     * @param {string} padding_scheme The padding scheme used to pad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {string|Buffer|Array} message The input message to encrypt.
     * @param {string|Buffer|Array} key The key used with the encryption cipher.
     * @param {boolean} convert_to_hex If true, the ciphertext is converted to a hex string, if false, it is
     *      converted to a Base64 string.
     * @param {boolean} is_message_hex If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @param {int} [key_size_bits] The size of the input key required for the chosen cipher. Defaults to 256 bits.
     * @param {int} [block_cipher_size] The size block cipher in bits. Defaults to 128 bits.
     * @param {string|Buffer|Array} [one_time_salt] If specified, contains the 64-bit salt used to derive an IV and
     *      Key used to encrypt the message.
     * @param {int} [kdf_iteration_rounds] The number of rounds used to derive the actual key and IV via sha256.
     * @returns {Buffer|null} Returns a Buffer() object containing the ciphertext or null if the chosen options are
     *      invalid.
     * @throws Exception indicating the error that occurred.
     */
    static __encrypt(
        symmetric_cipher,
        block_mode,
        padding_scheme,
        message,
        key,
        convert_to_hex,
        is_message_hex,
        key_size_bits = 256,
        block_cipher_size = 128,
        one_time_salt = undefined,
        kdf_iteration_rounds = 1000
    ) {
        const cipher_name = `${symmetric_cipher}${block_mode === undefined ? '' : '-' + block_mode}`;
        const crypto = require( 'crypto' );

        /* Buffered parameters. */
        let _message, _key, _iv, _salt, _derived, _encrypt;

        /* Make sure the cipher name and mode is valid first. */
        if (
            !discordCrypt.__isValidCipher( cipher_name ) || [ 'cbc', 'cfb', 'ofb' ]
                .indexOf( block_mode.toLowerCase() ) === -1
        )
            return null;

        /* Pad the message to the nearest block boundary. */
        _message = discordCrypt.__padMessage( message, padding_scheme, key_size_bits, is_message_hex );

        /* Get the key as a buffer. */
        _key = discordCrypt.__validateKeyIV( key, key_size_bits );

        /* Check if using a predefined salt. */
        if ( one_time_salt !== undefined ) {
            /* Convert the salt to a Buffer. */
            _salt = discordCrypt.__toBuffer( one_time_salt );

            /* Don't bother continuing if conversions have failed. */
            if ( !_salt || _salt.length === 0 )
                return null;

            /* Only 64 bits is used for a salt. If it's not that length, hash it and use the result. */
            if ( _salt.length !== 8 )
                _salt = Buffer.from( discordCrypt.whirlpool64( _salt, true ), 'hex' );
        }
        else
        /* Generate a random salt to derive the key and IV. */
            _salt = crypto.randomBytes( 8 );

        /* Derive the key length and IV length. */
        _derived = discordCrypt.pbkdf2_sha256( _key.toString( 'hex' ), _salt.toString( 'hex' ), true, true, true,
            ( block_cipher_size / 8 ) + ( key_size_bits / 8 ), kdf_iteration_rounds );

        /* Slice off the IV. */
        _iv = _derived.slice( 0, block_cipher_size / 8 );

        /* Slice off the key. */
        _key = _derived.slice( block_cipher_size / 8, ( block_cipher_size / 8 ) + ( key_size_bits / 8 ) );

        /* Create the cipher with derived IV and key. */
        _encrypt = crypto.createCipheriv( cipher_name, _key, _iv );

        /* Disable automatic PKCS #7 padding. We do this in-house. */
        _encrypt.setAutoPadding( false );

        /* Get the cipher text. */
        let _ct = _encrypt.update( _message, undefined, 'hex' );
        _ct += _encrypt.final( 'hex' );

        /* Return the result with the prepended salt. */
        return Buffer.from( _salt.toString( 'hex' ) + _ct, 'hex' ).toString( convert_to_hex ? 'hex' : 'base64' );
    }

    /**
     * @public
     * @desc Decrypts the given cipher-text message using the algorithm specified.
     * @param {string} symmetric_cipher The name of the symmetric cipher used to decrypt the message.
     *      This must be supported by NodeJS's crypto module.
     * @param {string} block_mode The block operation mode of the cipher.
     *      This can be either [ 'CBC', 'CFB', 'OFB' ].
     * @param {string} padding_scheme The padding scheme used to unpad the message from the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {string|Buffer|Array} message The input ciphertext message to decrypt.
     * @param {string|Buffer|Array} key The key used with the decryption cipher.
     * @param {boolean} output_format The output format of the plaintext.
     *      Can be either [ 'utf8', 'latin1', 'hex', 'base64' ]
     * @param {boolean} is_message_hex If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @param {int} [key_size_bits] The size of the input key required for the chosen cipher. Defaults to 256 bits.
     * @param {int} [block_cipher_size] The size block cipher in bits. Defaults to 128 bits.
     * @param {int} [kdf_iteration_rounds] The number of rounds used to derive the actual key and IV via sha256.
     * @returns {string|null} Returns a string of the desired format containing the plaintext or null if the chosen
     * options are invalid.
     * @throws Exception indicating the error that occurred.
     */
    static __decrypt(
        symmetric_cipher,
        block_mode,
        padding_scheme,
        message,
        key,
        output_format,
        is_message_hex,
        key_size_bits = 256,
        block_cipher_size = 128,
        kdf_iteration_rounds = 1000
    ) {
        const cipher_name = `${symmetric_cipher}${block_mode === undefined ? '' : '-' + block_mode}`;
        const crypto = require( 'crypto' );

        /* Buffered parameters. */
        let _message, _key, _iv, _salt, _derived, _decrypt;

        /* Make sure the cipher name and mode is valid first. */
        if ( !discordCrypt.__isValidCipher( cipher_name ) || [ 'cbc', 'ofb', 'cfb' ]
            .indexOf( block_mode.toLowerCase() ) === -1 )
            return null;

        /* Get the message as a buffer. */
        _message = discordCrypt.__validateMessage( message, is_message_hex );

        /* Get the key as a buffer. */
        _key = discordCrypt.__validateKeyIV( key, key_size_bits );

        /* Retrieve the 64-bit salt. */
        _salt = _message.slice( 0, 8 );

        /* Derive the key length and IV length. */
        _derived = discordCrypt.pbkdf2_sha256( _key.toString( 'hex' ), _salt.toString( 'hex' ), true, true, true,
            ( block_cipher_size / 8 ) + ( key_size_bits / 8 ), kdf_iteration_rounds );

        /* Slice off the IV. */
        _iv = _derived.slice( 0, block_cipher_size / 8 );

        /* Slice off the key. */
        _key = _derived.slice( block_cipher_size / 8, ( block_cipher_size / 8 ) + ( key_size_bits / 8 ) );

        /* Splice the message. */
        _message = _message.slice( 8 );

        /* Create the cipher with IV. */
        _decrypt = crypto.createDecipheriv( cipher_name, _key, _iv );

        /* Disable automatic PKCS #7 padding. We do this in-house. */
        _decrypt.setAutoPadding( false );

        /* Decrypt the cipher text. */
        let _pt = _decrypt.update( _message, undefined, 'hex' );
        _pt += _decrypt.final( 'hex' );

        /* Unpad the message. */
        _pt = discordCrypt.__padMessage( _pt, padding_scheme, key_size_bits, true, true );

        /* Return the buffer. */
        return _pt.toString( output_format );
    }


    /**
     * @public
     * @desc Blowfish encrypts a message.
     * @param {string|Buffer|Array} message The input message to encrypt.
     * @param {string|Buffer|Array} key The key used with the encryption cipher.
     * @param {string} cipher_mode The block operation mode of the cipher.
     *      This can be either [ 'CBC', 'CFB', 'OFB' ].
     * @param {string} padding_mode The padding scheme used to pad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {boolean} to_hex If true, the ciphertext is converted to a hex string, if false, it is
     *      converted to a Base64 string.
     * @param {boolean} is_message_hex If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @param {string|Buffer|Array} [one_time_salt] If specified, contains the 64-bit salt used to derive an IV and
     *      Key used to encrypt the message.
     * @param {int} [kdf_iteration_rounds] The number of rounds used to derive the actual key and IV via sha256.
     * @returns {Buffer} Returns a Buffer() object containing the resulting ciphertext.
     * @throws An exception indicating the error that occurred.
     */
    static blowfish512_encrypt(
        message,
        key,
        cipher_mode,
        padding_mode,
        to_hex = false,
        is_message_hex = undefined,
        one_time_salt = undefined,
        kdf_iteration_rounds = 1000
    ) {
        /* Size constants for Blowfish. */
        const keySize = 512, blockSize = 64;

        /* Perform the encryption. */
        return discordCrypt.__encrypt(
            'bf',
            cipher_mode,
            padding_mode,
            message,
            key,
            to_hex,
            is_message_hex,
            keySize,
            blockSize,
            one_time_salt,
            kdf_iteration_rounds
        );
    }

    /**
     * @public
     * @desc Blowfish decrypts a message.
     * @param {string|Buffer|Array} message The input message to decrypt.
     * @param {string|Buffer|Array} key The key used with the decryption cipher.
     * @param {string} cipher_mode The block operation mode of the cipher.
     *      This can be either [ 'CBC', 'CFB', 'OFB' ].
     * @param {string} padding_mode The padding scheme used to pad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {string} output_format The output format of the decrypted message.
     *      This can be either: [ 'hex', 'base64', 'latin1', 'utf8' ].
     * @param {boolean} [is_message_hex] If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @param {int} [kdf_iteration_rounds] The number of rounds used to derive the actual key and IV via sha256.
     * @returns {string|null} Returns a string of the desired format containing the plaintext or null if the chosen
     *      options are invalid.
     * @throws Exception indicating the error that occurred.
     */
    static blowfish512_decrypt(
        message,
        key,
        cipher_mode,
        padding_mode,
        output_format = 'utf8',
        is_message_hex = undefined,
        kdf_iteration_rounds = 1000
    ) {
        /* Size constants for Blowfish. */
        const keySize = 512, blockSize = 64;

        /* Return the unpadded message. */
        return discordCrypt.__decrypt(
            'bf',
            cipher_mode,
            padding_mode,
            message,
            key,
            output_format,
            is_message_hex,
            keySize,
            blockSize,
            kdf_iteration_rounds
        );
    }

    /**
     * @public
     * @desc AES-256 encrypts a message.
     * @param {string|Buffer|Array} message The input message to encrypt.
     * @param {string|Buffer|Array} key The key used with the encryption cipher.
     * @param {string} cipher_mode The block operation mode of the cipher.
     *      This can be either [ 'CBC', 'CFB', 'OFB' ].
     * @param {string} padding_mode The padding scheme used to pad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {boolean} to_hex If true, the ciphertext is converted to a hex string, if false, it is
     *      converted to a Base64 string.
     * @param {boolean} is_message_hex If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @param {string|Buffer|Array} [one_time_salt] If specified, contains the 64-bit salt used to derive an IV and
     *      Key used to encrypt the message.
     * @param {int} [kdf_iteration_rounds] The number of rounds used to derive the actual key and IV via sha256.
     * @returns {Buffer} Returns a Buffer() object containing the resulting ciphertext.
     * @throws An exception indicating the error that occurred.
     */
    static aes256_encrypt(
        message,
        key,
        cipher_mode,
        padding_mode,
        to_hex = false,
        is_message_hex = undefined,
        one_time_salt = undefined,
        kdf_iteration_rounds = 1000
    ) {
        /* Size constants for AES-256. */
        const keySize = 256, blockSize = 128;

        /* Perform the encryption. */
        return discordCrypt.__encrypt(
            'aes-256',
            cipher_mode,
            padding_mode,
            message,
            key,
            to_hex,
            is_message_hex,
            keySize,
            blockSize,
            one_time_salt,
            kdf_iteration_rounds
        );
    }

    /**
     * @public
     * @desc AES-256 decrypts a message.
     * @param {string|Buffer|Array} message The input message to decrypt.
     * @param {string|Buffer|Array} key The key used with the decryption cipher.
     * @param {string} cipher_mode The block operation mode of the cipher.
     *      This can be either [ 'CBC', 'CFB', 'OFB' ].
     * @param {string} padding_mode The padding scheme used to pad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {string} output_format The output format of the decrypted message.
     *      This can be either: [ 'hex', 'base64', 'latin1', 'utf8' ].
     * @param {boolean} [is_message_hex] If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @param {int} [kdf_iteration_rounds] The number of rounds used to derive the actual key and IV via sha256.
     * @returns {string|null} Returns a string of the desired format containing the plaintext or null if the chosen
     *      options are invalid.
     * @throws Exception indicating the error that occurred.
     */
    static aes256_decrypt(
        message,
        key,
        cipher_mode,
        padding_mode,
        output_format = 'utf8',
        is_message_hex = undefined,
        kdf_iteration_rounds = 1000
    ) {
        /* Size constants for AES-256. */
        const keySize = 256, blockSize = 128;

        /* Return the unpadded message. */
        return discordCrypt.__decrypt(
            'aes-256',
            cipher_mode,
            padding_mode,
            message,
            key,
            output_format,
            is_message_hex,
            keySize,
            blockSize,
            kdf_iteration_rounds
        );
    }

    /*  */
    /**
     * @public
     * @desc AES-256 decrypts a message in GCM mode.
     * @param {string|Buffer|Array} message The input message to encrypt.
     * @param {string|Buffer|Array} key The key used with the encryption cipher.
     * @param {string} padding_mode The padding scheme used to pad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {boolean} to_hex If true, the ciphertext is converted to a hex string, if false, it is
     *      converted to a Base64 string.
     * @param {boolean} is_message_hex If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @param {string|Buffer|Array} [additional_data] If specified, this additional data is used during GCM
     *      authentication.
     * @param {string|Buffer|Array} [one_time_salt] If specified, contains the 64-bit salt used to derive an IV and
     *      Key used to encrypt the message.
     * @param {int} [kdf_iteration_rounds] The number of rounds used to derive the actual key and IV via sha256.
     * @returns {Buffer} Returns a Buffer() object containing the resulting ciphertext.
     * @throws An exception indicating the error that occurred.
     */
    static aes256_encrypt_gcm(
        message,
        key,
        padding_mode,
        to_hex = false,
        is_message_hex = undefined,
        additional_data = undefined,
        one_time_salt = undefined,
        kdf_iteration_rounds = 1000
    ) {
        const block_cipher_size = 128, key_size_bits = 256;
        const cipher_name = 'aes-256-gcm';
        const crypto = require( 'crypto' );

        let _message, _key, _iv, _salt, _derived, _encrypt;

        /* Pad the message to the nearest block boundary. */
        _message = discordCrypt.__padMessage( message, padding_mode, key_size_bits, is_message_hex );

        /* Get the key as a buffer. */
        _key = discordCrypt.__validateKeyIV( key, key_size_bits );

        /* Check if using a predefined salt. */
        if ( one_time_salt !== undefined ) {
            /* Convert the salt to a Buffer. */
            _salt = discordCrypt.__toBuffer( one_time_salt );

            /* Don't bother continuing if conversions have failed. */
            if ( !_salt || _salt.length === 0 )
                return null;

            /* Only 64 bits is used for a salt. If it's not that length, hash it and use the result. */
            if ( _salt.length !== 8 )
                _salt = Buffer.from( discordCrypt.whirlpool64( _salt, true ), 'hex' );
        }
        else
        /* Generate a random salt to derive the key and IV. */
            _salt = crypto.randomBytes( 8 );

        /* Derive the key length and IV length. */
        _derived = discordCrypt.pbkdf2_sha256( _key.toString( 'hex' ), _salt.toString( 'hex' ), true, true, true,
            ( block_cipher_size / 8 ) + ( key_size_bits / 8 ), kdf_iteration_rounds );

        /* Slice off the IV. */
        _iv = _derived.slice( 0, block_cipher_size / 8 );

        /* Slice off the key. */
        _key = _derived.slice( block_cipher_size / 8, ( block_cipher_size / 8 ) + ( key_size_bits / 8 ) );

        /* Create the cipher with derived IV and key. */
        _encrypt = crypto.createCipheriv( cipher_name, _key, _iv );

        /* Add the additional data if necessary. */
        if ( additional_data !== undefined )
            _encrypt.setAAD( discordCrypt.__toBuffer( additional_data ) );

        /* Disable automatic PKCS #7 padding. We do this in-house. */
        _encrypt.setAutoPadding( false );

        /* Get the cipher text. */
        let _ct = _encrypt.update( _message, undefined, 'hex' );
        _ct += _encrypt.final( 'hex' );

        /* Return the auth tag prepended with the salt to the message. */
        return Buffer.from(
            _encrypt.getAuthTag().toString( 'hex' ) + _salt.toString( 'hex' ) + _ct,
            'hex'
        ).toString( to_hex ? 'hex' : 'base64' );
    }

    /**
     * @public
     * @desc AES-256 decrypts a message in GCM mode.
     * @param {string|Buffer|Array} message The input message to decrypt.
     * @param {string|Buffer|Array} key The key used with the decryption cipher.
     * @param {string} padding_mode The padding scheme used to pad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {string} output_format The output format of the decrypted message.
     *      This can be either: [ 'hex', 'base64', 'latin1', 'utf8' ].
     * @param {boolean} [is_message_hex] If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @param {string|Buffer|Array} [additional_data] If specified, this additional data is used during GCM
     *      authentication.
     * @param {int} [kdf_iteration_rounds] The number of rounds used to derive the actual key and IV via sha256.
     * @returns {string|null} Returns a string of the desired format containing the plaintext or null if the chosen
     *      options are invalid.
     * @throws Exception indicating the error that occurred.
     */
    static aes256_decrypt_gcm(
        message,
        key,
        padding_mode,
        output_format = 'utf8',
        is_message_hex = undefined,
        additional_data = undefined,
        kdf_iteration_rounds = 1000
    ) {
        const block_cipher_size = 128, key_size_bits = 256;
        const cipher_name = 'aes-256-gcm';
        const crypto = require( 'crypto' );

        /* Buffered parameters. */
        let _message, _key, _iv, _salt, _authTag, _derived, _decrypt;

        /* Get the message as a buffer. */
        _message = discordCrypt.__validateMessage( message, is_message_hex );

        /* Get the key as a buffer. */
        _key = discordCrypt.__validateKeyIV( key, key_size_bits );

        /* Retrieve the auth tag. */
        _authTag = _message.slice( 0, block_cipher_size / 8 );

        /* Splice the message. */
        _message = _message.slice( block_cipher_size / 8 );

        /* Retrieve the 64-bit salt. */
        _salt = _message.slice( 0, 8 );

        /* Splice the message. */
        _message = _message.slice( 8 );

        /* Derive the key length and IV length. */
        _derived = discordCrypt.pbkdf2_sha256( _key.toString( 'hex' ), _salt.toString( 'hex' ), true, true, true,
            ( block_cipher_size / 8 ) + ( key_size_bits / 8 ), kdf_iteration_rounds );

        /* Slice off the IV. */
        _iv = _derived.slice( 0, block_cipher_size / 8 );

        /* Slice off the key. */
        _key = _derived.slice( block_cipher_size / 8, ( block_cipher_size / 8 ) + ( key_size_bits / 8 ) );

        /* Create the cipher with IV. */
        _decrypt = crypto.createDecipheriv( cipher_name, _key, _iv );

        /* Set the authentication tag. */
        _decrypt.setAuthTag( _authTag );

        /* Set the additional data for verification if necessary. */
        if ( additional_data !== undefined )
            _decrypt.setAAD( discordCrypt.__toBuffer( additional_data ) );

        /* Disable automatic PKCS #7 padding. We do this in-house. */
        _decrypt.setAutoPadding( false );

        /* Decrypt the cipher text. */
        let _pt = _decrypt.update( _message, undefined, 'hex' );
        _pt += _decrypt.final( 'hex' );

        /* Unpad the message. */
        _pt = discordCrypt.__padMessage( _pt, padding_mode, key_size_bits, true, true );

        /* Return the buffer. */
        return _pt.toString( output_format );
    }

    /**
     * @public
     * @desc Camellia-256 encrypts a message.
     * @param {string|Buffer|Array} message The input message to encrypt.
     * @param {string|Buffer|Array} key The key used with the encryption cipher.
     * @param {string} cipher_mode The block operation mode of the cipher.
     *      This can be either [ 'CBC', 'CFB', 'OFB' ].
     * @param {string} padding_mode The padding scheme used to pad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {boolean} to_hex If true, the ciphertext is converted to a hex string, if false, it is
     *      converted to a Base64 string.
     * @param {boolean} is_message_hex If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @param {string|Buffer|Array} [one_time_salt] If specified, contains the 64-bit salt used to derive an IV and
     *      Key used to encrypt the message.
     * @param {int} [kdf_iteration_rounds] The number of rounds used to derive the actual key and IV via sha256.
     * @returns {Buffer} Returns a Buffer() object containing the resulting ciphertext.
     * @throws An exception indicating the error that occurred.
     */
    static camellia256_encrypt(
        message,
        key,
        cipher_mode,
        padding_mode,
        to_hex = false,
        is_message_hex = undefined,
        one_time_salt = undefined,
        kdf_iteration_rounds = 1000
    ) {
        /* Size constants for Camellia-256. */
        const keySize = 256, blockSize = 128;

        /* Perform the encryption. */
        return discordCrypt.__encrypt(
            'camellia-256',
            cipher_mode,
            padding_mode,
            message,
            key,
            to_hex,
            is_message_hex,
            keySize,
            blockSize,
            one_time_salt,
            kdf_iteration_rounds
        );
    }

    /**
     * @public
     * @desc Camellia-256 decrypts a message.
     * @param {string|Buffer|Array} message The input message to decrypt.
     * @param {string|Buffer|Array} key The key used with the decryption cipher.
     * @param {string} cipher_mode The block operation mode of the cipher.
     *      This can be either [ 'CBC', 'CFB', 'OFB' ].
     * @param {string} padding_mode The padding scheme used to pad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {string} output_format The output format of the decrypted message.
     *      This can be either: [ 'hex', 'base64', 'latin1', 'utf8' ].
     * @param {boolean} [is_message_hex] If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @param {int} [kdf_iteration_rounds] The number of rounds used to derive the actual key and IV via sha256.
     * @returns {string|null} Returns a string of the desired format containing the plaintext or null if the chosen
     *      options are invalid.
     * @throws Exception indicating the error that occurred.
     */
    static camellia256_decrypt(
        message,
        key,
        cipher_mode,
        padding_mode,
        output_format = 'utf8',
        is_message_hex = undefined,
        kdf_iteration_rounds = 1000
    ) {
        /* Size constants for Camellia-256. */
        const keySize = 256, blockSize = 128;

        /* Return the unpadded message. */
        return discordCrypt.__decrypt(
            'camellia-256',
            cipher_mode,
            padding_mode,
            message,
            key,
            output_format,
            is_message_hex,
            keySize,
            blockSize,
            kdf_iteration_rounds
        );
    }

    /**
     * @public
     * @desc TripleDES-192 encrypts a message.
     * @param {string|Buffer|Array} message The input message to encrypt.
     * @param {string|Buffer|Array} key The key used with the encryption cipher.
     * @param {string} cipher_mode The block operation mode of the cipher.
     *      This can be either [ 'CBC', 'CFB', 'OFB' ].
     * @param {string} padding_mode The padding scheme used to pad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {boolean} to_hex If true, the ciphertext is converted to a hex string, if false, it is
     *      converted to a Base64 string.
     * @param {boolean} is_message_hex If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @param {string|Buffer|Array} [one_time_salt] If specified, contains the 64-bit salt used to derive an IV and
     *      Key used to encrypt the message.
     * @param {int} [kdf_iteration_rounds] The number of rounds used to derive the actual key and IV via sha256.
     * @returns {Buffer} Returns a Buffer() object containing the resulting ciphertext.
     * @throws An exception indicating the error that occurred.
     */
    static tripledes192_encrypt(
        message,
        key,
        cipher_mode,
        padding_mode,
        to_hex = false,
        is_message_hex = undefined,
        one_time_salt = undefined,
        kdf_iteration_rounds = 1000
    ) {
        /* Size constants for TripleDES-192. */
        const keySize = 192, blockSize = 64;

        /* Perform the encryption. */
        return discordCrypt.__encrypt(
            'des-ede3',
            cipher_mode,
            padding_mode,
            message,
            key,
            to_hex,
            is_message_hex,
            keySize,
            blockSize,
            one_time_salt,
            kdf_iteration_rounds
        );
    }

    /**
     * @public
     * @desc TripleDES-192 decrypts a message.
     * @param {string|Buffer|Array} message The input message to decrypt.
     * @param {string|Buffer|Array} key The key used with the decryption cipher.
     * @param {string} cipher_mode The block operation mode of the cipher.
     *      This can be either [ 'CBC', 'CFB', 'OFB' ].
     * @param {string} padding_mode The padding scheme used to pad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {string} output_format The output format of the decrypted message.
     *      This can be either: [ 'hex', 'base64', 'latin1', 'utf8' ].
     * @param {boolean} [is_message_hex] If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @param {int} [kdf_iteration_rounds] The number of rounds used to derive the actual key and IV via sha256.
     * @returns {string|null} Returns a string of the desired format containing the plaintext or null if the chosen
     *      options are invalid.
     * @throws Exception indicating the error that occurred.
     */
    static tripledes192_decrypt(
        message,
        key,
        cipher_mode,
        padding_mode,
        output_format = 'utf8',
        is_message_hex = undefined,
        kdf_iteration_rounds = 1000
    ) {
        /* Size constants for TripleDES-192. */
        const keySize = 192, blockSize = 64;

        /* Return the unpadded message. */
        return discordCrypt.__decrypt(
            'des-ede3',
            cipher_mode,
            padding_mode,
            message,
            key,
            output_format,
            is_message_hex,
            keySize,
            blockSize,
            kdf_iteration_rounds
        );
    }

    /**
     * @public
     * @desc IDEA-128 encrypts a message.
     * @param {string|Buffer|Array} message The input message to encrypt.
     * @param {string|Buffer|Array} key The key used with the encryption cipher.
     * @param {string} cipher_mode The block operation mode of the cipher.
     *      This can be either [ 'CBC', 'CFB', 'OFB' ].
     * @param {string} padding_mode The padding scheme used to pad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {boolean} to_hex If true, the ciphertext is converted to a hex string, if false, it is
     *      converted to a Base64 string.
     * @param {boolean} is_message_hex If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @param {string|Buffer|Array} [one_time_salt] If specified, contains the 64-bit salt used to derive an IV and
     *      Key used to encrypt the message.
     * @param {int} [kdf_iteration_rounds] The number of rounds used to derive the actual key and IV via sha256.
     * @returns {Buffer} Returns a Buffer() object containing the resulting ciphertext.
     * @throws An exception indicating the error that occurred.
     */
    static idea128_encrypt(
        message,
        key,
        cipher_mode,
        padding_mode,
        to_hex = false,
        is_message_hex = undefined,
        one_time_salt = undefined,
        kdf_iteration_rounds = 1000
    ) {
        /* Size constants for IDEA-128. */
        const keySize = 128, blockSize = 64;

        /* Perform the encryption. */
        return discordCrypt.__encrypt(
            'idea',
            cipher_mode,
            padding_mode,
            message,
            key,
            to_hex,
            is_message_hex,
            keySize,
            blockSize,
            one_time_salt,
            kdf_iteration_rounds
        );
    }

    /**
     * @public
     * @desc IDEA-128 decrypts a message.
     * @param {string|Buffer|Array} message The input message to decrypt.
     * @param {string|Buffer|Array} key The key used with the decryption cipher.
     * @param {string} cipher_mode The block operation mode of the cipher.
     *      This can be either [ 'CBC', 'CFB', 'OFB' ].
     * @param {string} padding_mode The padding scheme used to pad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {string} output_format The output format of the decrypted message.
     *      This can be either: [ 'hex', 'base64', 'latin1', 'utf8' ].
     * @param {boolean} [is_message_hex] If true, the message is treated as a hex string, if false, it is treated as
     *      a Base64 string. If undefined, the message is treated as a UTF-8 string.
     * @param {int} [kdf_iteration_rounds] The number of rounds used to derive the actual key and IV via sha256.
     * @returns {string|null} Returns a string of the desired format containing the plaintext or null if the chosen
     *      options are invalid.
     * @throws Exception indicating the error that occurred.
     */
    static idea128_decrypt(
        message,
        key,
        cipher_mode,
        padding_mode,
        output_format = 'utf8',
        is_message_hex = undefined,
        kdf_iteration_rounds = 1000
    ) {
        /* Size constants for IDEA-128. */
        const keySize = 128, blockSize = 64;

        /* Return the unpadded message. */
        return discordCrypt.__decrypt(
            'idea',
            cipher_mode,
            padding_mode,
            message,
            key,
            output_format,
            is_message_hex,
            keySize,
            blockSize,
            kdf_iteration_rounds
        );
    }

    /* ============== END CRYPTO CIPHER FUNCTIONS ============== */

    /**
     * @public
     * @desc Converts a cipher string to its appropriate index number.
     * @param {string} primary_cipher The primary cipher.
     *      This can be either [ 'bf', 'aes', 'camel', 'idea', 'tdes' ].
     * @param {string} [secondary_cipher] The secondary cipher.
     *      This can be either [ 'bf', 'aes', 'camel', 'idea', 'tdes' ].
     * @returns {int} Returns the index value of the algorithm.
     */
    static cipherStringToIndex( primary_cipher, secondary_cipher = undefined ) {
        let value = 0;

        /* Return if already a number. */
        if ( typeof primary_cipher === 'number' )
            return primary_cipher;

        /* Check if it's a joined string. */
        if ( typeof primary_cipher === 'string' && primary_cipher.search( '-' ) !== -1 &&
            secondary_cipher === undefined ) {
            primary_cipher = primary_cipher.split( '-' )[ 0 ];
            secondary_cipher = primary_cipher.split( '-' )[ 1 ];
        }

        /* Resolve the primary index. */
        switch ( primary_cipher ) {
            case 'bf':
                /* value = 0; */
                break;
            case 'aes':
                value = 1;
                break;
            case 'camel':
                value = 2;
                break;
            case 'idea':
                value = 3;
                break;
            case 'tdes':
                value = 4;
                break;
            default:
                return 0;
        }

        /* Make sure the secondary is valid. */
        if ( secondary_cipher !== undefined ) {
            switch ( secondary_cipher ) {
                case 'bf':
                    /* value = 0; */
                    break;
                case 'aes':
                    value += 5;
                    break;
                case 'camel':
                    value += 10;
                    break;
                case 'idea':
                    value += 15;
                    break;
                case 'tdes':
                    value += 20;
                    break;
                default:
                    break;
            }
        }

        /* Return the index. */
        return value;
    }

    /**
     * @public
     * @desc Converts an algorithm index to its appropriate string value.
     * @param {int} index The index of the cipher(s) used.
     * @param {boolean} get_secondary Whether to retrieve the secondary algorithm name.
     * @returns {string} Returns a shorthand representation of either the primary or secondary cipher.
     *      This can be either [ 'bf', 'aes', 'camel', 'idea', 'tdes' ].
     */
    static cipherIndexToString( index, get_secondary = undefined ) {

        /* Strip off the secondary. */
        if ( get_secondary !== undefined && get_secondary ) {
            if ( index >= 20 )
                return 'tdes';
            else if ( index >= 15 )
                return 'idea';
            else if ( index >= 10 )
                return 'camel';
            else if ( index >= 5 )
                return 'aes';
            else
                return 'bf';
        }
        /* Remove the secondary. */
        else if ( index >= 20 )
            index -= 20;
        else if ( index >= 15 && index <= 19 )
            index -= 15;
        else if ( index >= 10 && index <= 14 )
            index -= 10;
        else if ( index >= 5 && index <= 9 )
            index -= 5;

        /* Calculate the primary. */
        if ( index === 1 )
            return 'aes';
        else if ( index === 2 )
            return 'camel';
        else if ( index === 3 )
            return 'idea';
        else if ( index === 4 )
            return 'tdes';
        else
            return 'bf';
    }

    /**
     * @public
     * @desc Converts an input string to the approximate entropic bits using Shannon's algorithm.
     * @param {string} key The input key to check.
     * @returns {int} Returns the approximate number of bits of entropy contained in the key.
     */
    static entropicBitLength( key ) {
        let h = Object.create( null ), k;
        let sum = 0, len = key.length;

        key.split( '' ).forEach( c => {
            h[ c ] ? h[ c ]++ : h[ c ] = 1;
        } );

        for ( k in h ) {
            let p = h[ k ] / len;
            sum -= p * Math.log( p ) / Math.log( 2 );
        }

        return parseInt( sum * len );
    }

    /**
     * @public
     * @desc Retrieves UTF-16 charset as an Array Object.
     * @returns {Array} Returns an array containing 64 characters used for substitution.
     */
    static getUtf16() {
        return Array.from( "⣀⣁⣂⣃⣄⣅⣆⣇⣈⣉⣊⣋⣌⣍⣎⣏⣐⣑⣒⣓⣔⣕⣖⣗⣘⣙⣚⣛⣜⣝⣞⣟⣠⣡⣢⣣⣤⣥⣦⣧⣨⣩⣪⣫⣬⣭⣮⣯⣰⣱⣲⣳⣴⣵⣶⣷⣸⣹⣺⣻⣼⣽⣾⣿⢿" );
    }

    /**
     * @public
     * @desc Determines if a string has all valid UTF-16 characters according to the result from getUtf16().
     * @param {string} message The message to validate.
     * @returns {boolean} Returns true if the message contains only the required character set.
     */
    static isValidUtf16( message ) {
        let c = discordCrypt.getUtf16();
        let m = message.split( '' ).join( '' );

        for ( let i = 0; i < m.length; i++ )
            if ( c.indexOf( m[ i ] ) === -1 )
                return false;

        return true;
    }

    /**
     * @public
     * @desc Retrieves Base64 charset as an Array Object.
     * @returns {Array} Returns an array of all 64 characters used in Base64 + encoding characters.
     */
    static getBase64() {
        return Array.from( "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=" );
    }

    /**
     * @public
     * @desc Determines if a string has all valid Base64 characters including encoding characters.
     * @param {string} message The message to validate.
     * @returns {boolean} Returns true if the message contains only the required character set.
     */
    static isValidBase64( message ) {
        try {
            let b64 = discordCrypt.getBase64();

            for ( let c in message ) {
                if ( b64.indexOf( c ) === -1 )
                    return false;
            }

            return true;
        } catch ( e ) {
            return false;
        }
    }

    /**
     * @public
     * @desc Returns an array of valid Diffie-Hellman exchange key bit-sizes.
     * @returns {number[]} Returns the bit lengths of all supported DH keys.
     */
    static getDHBitSizes() {
        return [ 768, 1024, 1536, 2048, 3072, 4096, 6144, 8192 ];
    }

    /**
     * @public
     * @desc Returns an array of Elliptic-Curve Diffie-Hellman key bit-sizes.
     * @returns {number[]} Returns the bit lengths of all supported ECDH keys.
     */
    static getECDHBitSizes() {
        return [ 224, 256, 384, 409, 521, 571 ];
    }

    /**
     * @public
     * @desc Determines if a key exchange algorithm's index is valid.
     * @param {int} index The index to determine if valid.
     * @returns {boolean} Returns true if the desired index meets one of the ECDH or DH key sizes.
     */
    static isValidExchangeAlgorithm( index ) {
        return index >= 0 &&
            index <= ( discordCrypt.getDHBitSizes().length + discordCrypt.getECDHBitSizes().length - 1 );
    }

    /**
     * @public
     * @desc Converts an algorithm index to a string.
     * @param {int} index The input index of the exchange algorithm.
     * @returns {string} Returns a string containing the algorithm or "Invalid Algorithm".
     */
    static indexToExchangeAlgorithmString( index ) {
        let dh_bl = discordCrypt.getDHBitSizes(), ecdh_bl = discordCrypt.getECDHBitSizes();
        let base = [ 'DH-', 'ECDH-' ];

        if ( !discordCrypt.isValidExchangeAlgorithm( index ) )
            return 'Invalid Algorithm';

        return ( index <= ( dh_bl.length - 1 ) ?
            base[ 0 ] + dh_bl[ index ] :
            base[ 1 ] + ecdh_bl[ index - dh_bl.length ] );
    }

    /**
     * @public
     * @desc Converts an algorithm index to a bit size.
     * @param {int} index The index to convert to the bit length.
     * @returns {int} Returns 0 if the index is invalid or the bit length of the index.
     */
    static indexToAlgorithmBitLength( index ) {
        let dh_bl = discordCrypt.getDHBitSizes(), ecdh_bl = discordCrypt.getECDHBitSizes();

        if ( !discordCrypt.isValidExchangeAlgorithm( index ) )
            return 0;

        return ( index <= ( dh_bl.length - 1 ) ? dh_bl[ index ] : ecdh_bl[ index - dh_bl.length ] );
    }

    /**
     * @public
     * @desc Computes a secret key from two ECDH or DH keys. One private and one public.
     * @param {Object} private_key A private key DH or ECDH object from NodeJS's crypto module.
     * @param {string} public_key The public key as a string in Base64 or hex format.
     * @param {boolean} is_base_64 Whether the public key is a Base64 string. If false, it is assumed to be hex.
     * @param {boolean} to_base_64 Whether to convert the output secret to Base64.
     *      If false, it is converted to hex.
     * @returns {string|null} Returns a string encoded secret on success or null on failure.
     */
    static computeExchangeSharedSecret( private_key, public_key, is_base_64, to_base_64 ) {
        let in_form, out_form;

        /* Compute the formats. */
        in_form = is_base_64 ? 'base64' : 'hex';
        out_form = to_base_64 ? 'base64' : 'hex';

        /* Compute the derived key and return. */
        try {
            return private_key.computeSecret( public_key, in_form, out_form );
        }
        catch ( e ) {
            return null;
        }
    }

    /**
     * @public
     * @desc Generates a Diffie-Hellman key pair.
     * @param {int} size The bit length of the desired key pair.
     *      This must be one of the supported lengths retrieved from getDHBitSizes().
     * @param {Buffer} private_key The optional private key used to initialize the object.
     * @returns {Object|null} Returns a DiffieHellman object on success or null on failure.
     */
    static generateDH( size, private_key = undefined ) {
        let groupName, key;

        /* Calculate the appropriate group. */
        switch ( size ) {
            case 768:
                groupName = 'modp1';
                break;
            case 1024:
                groupName = 'modp2';
                break;
            case 1536:
                groupName = 'modp5';
                break;
            case 2048:
                groupName = 'modp14';
                break;
            case 3072:
                groupName = 'modp15';
                break;
            case 4096:
                groupName = 'modp16';
                break;
            case 6144:
                groupName = 'modp17';
                break;
            case 8192:
                groupName = 'modp18';
                break;
            default:
                return null;
        }

        /* Create the key object. */
        try {
            key = require( 'crypto' ).getDiffieHellman( groupName );
        }
        catch ( err ) {
            return null;
        }

        /* Generate the key if it's valid. */
        if ( key !== undefined && key !== null && typeof key.generateKeys !== 'undefined' ) {
            if ( private_key === undefined )
                key.generateKeys();
            else if ( typeof key.setPrivateKey !== 'undefined' )
                key.setPrivateKey( private_key );
        }

        /* Return the result. */
        return key;
    }

    /**
     * @public
     * @desc Generates a Elliptic-Curve Diffie-Hellman key pair.
     * @param {int} size The bit length of the desired key pair.
     *      This must be one of the supported lengths retrieved from getECDHBitSizes().
     * @param {Buffer} private_key The optional private key used to initialize the object.
     * @returns {Object|null} Returns a ECDH object on success or null on failure.
     */
    static generateECDH( size, private_key = undefined ) {
        let groupName, key;

        /* Calculate the appropriate group. */
        switch ( size ) {
            case 224:
                groupName = 'secp224r1';
                break;
            case 256:
                groupName = 'secp256k1';
                break;
            case 384:
                groupName = 'secp384r1';
                break;
            case 409:
                groupName = 'sect409r1';
                break;
            case 521:
                groupName = 'secp521r1';
                break;
            case 571:
                groupName = 'sect571r1';
                break;
            default:
                return null;
        }

        /* Create the key object. */
        try {
            key = require( 'crypto' ).createECDH( groupName );
        }
        catch ( err ) {
            return null;
        }

        /* Generate the key if it's valid. */
        if ( key !== undefined && key !== null && typeof key.generateKeys !== 'undefined' ) {
            /* Generate a new key if the private key is undefined else set the private key. */
            if ( private_key === undefined )
                key.generateKeys( 'hex', 'compressed' );
            else if ( typeof key.setPrivateKey !== 'undefined' )
                key.setPrivateKey( private_key );
        }

        /* Return the result. */
        return key;
    }

    /**
     * @public
     * @desc Substitutes an input Base64 message to the UTF-16 equivalent from getUtf16().
     * @param {string} message The input message to perform substitution on.
     * @param {boolean} convert Whether the message is to be converted from Base64 to UTF-16 or from UTF-16 to Base64.
     * @returns {string} Returns the substituted string encoded message.
     * @throws An exception indicating the message contains characters not in the character set.
     */
    static substituteMessage( /* string */ message, /* boolean */ convert ) {
        /* Target character set. */
        let subset = discordCrypt.getUtf16();

        /* Base64-Character set. */
        let original = discordCrypt.getBase64();

        let result = "", index = 0;

        if ( convert !== undefined ) {
            /* Calculate the target character. */
            for ( let i = 0; i < message.length; i++ ) {
                index = original.indexOf( message[ i ] );

                /* Sanity check. */
                if ( index === -1 )
                    throw 'Message contains invalid characters.';

                result += subset[ index ];
            }

            /* Strip the extra UTF16 character that might somehow be added. */
            result = result.split( '' ).join( '' );
        }
        else {
            /* Strip the extra UTF16 character then decode the message. */
            message = message.split( '' ).join( '' );

            /* Calculate the target character. */
            for ( let i = 0; i < message.length; i++ ) {
                index = subset.indexOf( message[ i ] );

                /* Sanity check. */
                if ( index === -1 )
                    throw 'Message contains invalid characters.';

                result += original[ subset.indexOf( message[ i ] ) ];
            }
        }

        return result;
    }

    /**
     * @public
     * @desc Encodes the given values as a Base64 encoded 32-bit word.
     * @param {int} cipherIndex The index of the cipher(s) used to encrypt the message
     * @param {int} cipherModeIndex The index of the cipher block mode used for the message.
     * @param {int} paddingIndex The index of the padding scheme for the message.
     * @param {int} pad The padding byte to use.
     * @returns {string} Returns a substituted UTF-16 string of a Base64 encoded 32-bit word containing these options.
     */
    static metaDataEncode( cipherIndex, cipherModeIndex, paddingIndex, pad ) {
        /* Buffered word. */
        let buf = Buffer.alloc( 4 );

        /* Target character set. */
        let subset = discordCrypt.getUtf16();

        /* Base64-Character set. */
        let original = discordCrypt.getBase64();

        let result = "", msg;

        /* Parse the first 8 bits. */
        if ( typeof cipherIndex === 'string' )
            cipherIndex = discordCrypt.cipherStringToIndex( cipherIndex );
        buf[ 0 ] = cipherIndex;

        /* Parse the next 8 bits. */
        if ( typeof cipherModeIndex === 'string' )
            cipherModeIndex = [ 'cbc', 'cfb', 'ofb' ].indexOf( cipherModeIndex.toLowerCase() );
        buf[ 1 ] = cipherModeIndex;

        /* Parse the next 8 bits. */
        if ( typeof paddingIndex === 'string' )
            paddingIndex = [ 'pkc7', 'ans2', 'iso1', 'iso9' ].indexOf( paddingIndex.toLowerCase() );
        buf[ 2 ] = paddingIndex;

        /* Add padding. */
        pad = parseInt( pad );
        buf[ 3 ] = pad;

        /* Convert to Base64. */
        msg = buf.toString( 'base64' );

        /* Calculate the target character. */
        for ( let i = 0; i < msg.length; i++ )
            result += subset[ original.indexOf( msg[ i ] ) ];

        return result;
    }

    /**
     * @public
     * @desc Decodes an input string and returns a byte array containing index number of options.
     * @param {string} message The substituted UTF-16 encoded metadata containing the metadata options.
     * @returns {int[]} Returns 4 integer indexes of each metadata value.
     */
    static metaDataDecode( message ) {
        /* Target character set. */
        let subset = discordCrypt.getUtf16();

        /* Base64-Character set. */
        let original = discordCrypt.getBase64();

        let result = "", msg, buf;

        /* Strip the extra UTF16 character then decode the message */
        msg = message.split( '' ).join( '' );

        /* Calculate the target character. */
        for ( let i = 0; i < msg.length; i++ )
            result += original[ subset.indexOf( msg[ i ] ) ];

        /* Convert from base64. */
        buf = Buffer.from( result, 'base64' );

        return [
            buf[ 0 ],
            buf[ 1 ],
            buf[ 2 ],
            buf[ 3 ]
        ];
    }

    /**
     * @public
     * @desc Dual-encrypts a message using symmetric keys and returns the substituted encoded equivalent.
     * @param {string|Buffer} message The input message to encrypt.
     * @param {Buffer} primary_key The primary key used for the first level of encryption.
     * @param {Buffer} secondary_key The secondary key used for the second level of encryption.
     * @param {int} cipher_index The cipher index containing the primary and secondary ciphers used for encryption.
     * @param {string} block_mode The block operation mode of the ciphers.
     *      These can be: [ 'CBC', 'CFB', 'OFB' ].
     * @param {string} padding_mode The padding scheme used to pad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {boolean} use_hmac Whether to enable HMAC authentication on the message.
     *      This prepends a 64 bit seed used to derive encryption keys from the initial key.
     * @returns {string|null} Returns the encrypted and substituted ciphertext of the message or null on failure.
     * @throws An exception indicating the error that occurred.
     */
    static symmetricEncrypt( message, primary_key, secondary_key, cipher_index, block_mode, padding_mode, use_hmac ) {

        /* Performs one of the 5 standard encryption algorithms on the plain text. */
        function handleEncodeSegment( message, key, cipher, mode, pad ) {
            switch ( cipher ) {
                case 0:
                    return discordCrypt.blowfish512_encrypt( message, key, mode, pad );
                case 1:
                    return discordCrypt.aes256_encrypt( message, key, mode, pad );
                case 2:
                    return discordCrypt.camellia256_encrypt( message, key, mode, pad );
                case 3:
                    return discordCrypt.idea128_encrypt( message, key, mode, pad );
                case 4:
                    return discordCrypt.tripledes192_encrypt( message, key, mode, pad );
                default:
                    return null;
            }
        }

        /* Convert the block mode. */
        let mode = block_mode.toLowerCase();

        /* Convert the padding. */
        let pad = padding_mode;

        /* Encode using the user-specified symmetric algorithm. */
        let msg = '';

        /* Dual-encrypt the segment. */
        if ( cipher_index >= 0 && cipher_index <= 4 )
            msg = discordCrypt.blowfish512_encrypt(
                handleEncodeSegment( message, primary_key, cipher_index, mode, pad ),
                secondary_key,
                mode,
                pad,
                use_hmac,
                false
            );
        else if ( cipher_index >= 5 && cipher_index <= 9 )
            msg = discordCrypt.aes256_encrypt(
                handleEncodeSegment( message, primary_key, cipher_index - 5, mode, pad ),
                secondary_key,
                mode,
                pad,
                use_hmac,
                false
            );
        else if ( cipher_index >= 10 && cipher_index <= 14 )
            msg = discordCrypt.camellia256_encrypt(
                handleEncodeSegment( message, primary_key, cipher_index - 10, mode, pad ),
                secondary_key,
                mode,
                pad,
                use_hmac,
                false
            );
        else if ( cipher_index >= 15 && cipher_index <= 19 )
            msg = discordCrypt.idea128_encrypt(
                handleEncodeSegment( message, primary_key, cipher_index - 15, mode, pad ),
                secondary_key,
                mode,
                pad,
                use_hmac,
                false
            );
        else if ( cipher_index >= 20 && cipher_index <= 24 )
            msg = discordCrypt.tripledes192_encrypt(
                handleEncodeSegment( message, primary_key, cipher_index - 20, mode, pad ),
                secondary_key,
                mode,
                pad,
                use_hmac,
                false
            );

        /* If using HMAC mode, compute the HMAC of the ciphertext and prepend it. */
        if ( use_hmac ) {
            /* Get MAC tag as a hex string. */
            let tag = discordCrypt.hmac_sha256( Buffer.from( msg, 'hex' ), primary_key, true );

            /* Prepend the authentication tag hex string & convert it to Base64. */
            msg = Buffer.from( tag + msg, 'hex' ).toString( 'base64' );
        }

        /* Return the message. */
        return discordCrypt.substituteMessage( msg, true );
    }

    /**
     * @public
     * @desc Dual-decrypts a message using symmetric keys and returns the substituted encoded equivalent.
     * @param {string|Buffer|Array} message The substituted and encoded input message to decrypt.
     * @param {Buffer} primary_key The primary key used for the **second** level of decryption.
     * @param {Buffer} secondary_key The secondary key used for the **first** level of decryption.
     * @param {int} cipher_index The cipher index containing the primary and secondary ciphers used for decryption.
     * @param {string} block_mode The block operation mode of the ciphers.
     *      These can be: [ 'CBC', 'CFB', 'OFB' ].
     * @param {string} padding_mode The padding scheme used to unpad the message to the block length of the cipher.
     *      This can be either [ 'ANS1', 'PKC7', 'ISO1', 'ISO9' ].
     * @param {boolean} use_hmac Whether to enable HMAC authentication on the message.
     *      If this is enabled and authentication fails, null is returned.
     *      This prepends a 64 bit seed used to derive encryption keys from the initial key.
     * @returns {string|null} Returns the encrypted and substituted ciphertext of the message or null on failure.
     * @throws An exception indicating the error that occurred.
     */
    static symmetricDecrypt( message, primary_key, secondary_key, cipher_index, block_mode, padding_mode, use_hmac ) {
        const crypto = require( 'crypto' );

        /* Performs one of the 5 standard decryption algorithms on the plain text. */
        function handleDecodeSegment(
            message,
            key,
            cipher,
            mode,
            pad,
            output_format = 'utf8',
            is_message_hex = undefined
        ) {
            switch ( cipher ) {
                case 0:
                    return discordCrypt.blowfish512_decrypt( message, key, mode, pad, output_format, is_message_hex );
                case 1:
                    return discordCrypt.aes256_decrypt( message, key, mode, pad, output_format, is_message_hex );
                case 2:
                    return discordCrypt.camellia256_decrypt( message, key, mode, pad, output_format, is_message_hex );
                case 3:
                    return discordCrypt.idea128_decrypt( message, key, mode, pad, output_format, is_message_hex );
                case 4:
                    return discordCrypt.tripledes192_decrypt( message, key, mode, pad, output_format, is_message_hex );
                default:
                    return null;
            }
        }

        let mode, pad;

        /* Convert the block mode. */
        if ( typeof block_mode !== 'string' ) {
            if ( block_mode === 0 )
                mode = 'cbc';
            else if ( block_mode === 1 )
                mode = 'cfb';
            else if ( block_mode === 2 )
                mode = 'ofb';
            else return '';
        }

        /* Convert the padding. */
        if ( typeof padding_mode !== 'string' ) {
            if ( padding_mode === 0 )
                pad = 'pkc7';
            else if ( padding_mode === 1 )
                pad = 'ans2';
            else if ( padding_mode === 2 )
                pad = 'iso1';
            else if ( padding_mode === 3 )
                pad = 'iso9';
            else return '';
        }

        try {
            /* Decode level-1 message. */
            message = discordCrypt.substituteMessage( message );

            /* If using HMAC, strip off the HMAC and compare it before proceeding. */
            if ( use_hmac ) {
                /* Convert to a Buffer. */
                message = Buffer.from( message, 'base64' );

                /* Pull off the first 32 bytes as a buffer. */
                let tag = Buffer.from( message.subarray( 0, 32 ) );

                /* Strip off the authentication tag. */
                message = Buffer.from( message.subarray( 32 ) );

                /* Compute the HMAC-SHA-256 of the cipher text as hex. */
                let computed_tag = Buffer.from( discordCrypt.hmac_sha256( message, primary_key, true ), 'hex' );

                /* Compare the tag for validity. */
                if ( !crypto.timingSafeEqual( computed_tag, tag ) )
                    return 1;
            }

            /* Dual decrypt the segment. */
            if ( cipher_index >= 0 && cipher_index <= 4 )
                return handleDecodeSegment(
                    discordCrypt.blowfish512_decrypt( message, secondary_key, mode, pad, 'base64' ),
                    primary_key,
                    cipher_index,
                    mode,
                    pad,
                    'utf8',
                    false
                );
            else if ( cipher_index >= 5 && cipher_index <= 9 )
                return handleDecodeSegment(
                    discordCrypt.aes256_decrypt( message, secondary_key, mode, pad, 'base64' ),
                    primary_key,
                    cipher_index - 5,
                    mode,
                    pad,
                    'utf8',
                    false
                );
            else if ( cipher_index >= 10 && cipher_index <= 14 )
                return handleDecodeSegment(
                    discordCrypt.camellia256_decrypt( message, secondary_key, mode, pad, 'base64' ),
                    primary_key,
                    cipher_index - 10,
                    mode,
                    pad,
                    'utf8',
                    false
                );
            else if ( cipher_index >= 15 && cipher_index <= 19 )
                return handleDecodeSegment(
                    discordCrypt.idea128_decrypt( message, secondary_key, mode, pad, 'base64' ),
                    primary_key,
                    cipher_index - 15,
                    mode,
                    pad,
                    'utf8',
                    false
                );
            else if ( cipher_index >= 20 && cipher_index <= 24 )
                return handleDecodeSegment(
                    discordCrypt.tripledes192_decrypt( message, secondary_key, mode, pad, 'base64' ),
                    primary_key,
                    cipher_index - 20,
                    mode,
                    pad,
                    'utf8',
                    false
                );
            return -3;
        }
        catch ( e ) {
            return 2;
        }
    }

    /* ================ END CRYPTO CALLBACKS =================== */
}

/* Required for code coverage reports. */
module.exports = { discordCrypt };