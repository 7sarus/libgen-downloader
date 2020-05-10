import { Interfaces } from './interfaces.namespace';
import { UIInterfaces } from '../ui';

import CONFIG from './config';
import CONSTANTS from './constants';

import UI from '../ui';
import UIObjects from './modules/UIObjects';
import Selectors from './modules/selectors';
import Entries from './modules/entries';

import fetch, { Response } from 'node-fetch';
import inquirer from 'inquirer';
import ProgressBar from 'progress';
import { Spinner } from 'cli-spinner';
import { JSDOM } from 'jsdom';

import readline from 'readline';
import { EventEmitter } from 'events';
import fs from 'fs';

export default class App implements Interfaces.App {
    state: Interfaces.AppState;
    // prompt: inquirer.PromptModule;
    spinner: Spinner;
    eventEmitter: EventEmitter;

    events: {
        USER_SELECTED_FROM_LIST: string,
        USER_SELECTED_IN_ENTRY_DETAILS: string,
        USER_SELECTED_AFTER_DOWNLOAD: string,
        USER_SELECTED_AFTER_NORESULT: string
    }

    constructor() {
        this.state = this.createNewAppState();
        // this.prompt = inquirer.createPromptModule();
        this.spinner = new Spinner();
        this.eventEmitter = new EventEmitter();

        this.events = {
            USER_SELECTED_FROM_LIST: 'user_selected_from_list',
            USER_SELECTED_IN_ENTRY_DETAILS: 'user_selected_in_entry_details',
            USER_SELECTED_AFTER_DOWNLOAD: 'user_selected_after_download',
            USER_SELECTED_AFTER_NORESULT: 'user_selected_after_noresult'
        }
    }

    /**  **************************************************  */
    createNewAppState(): Interfaces.AppState {
        return {
            currentPage: 1,
            url: '',
            query: null,
            isNextPageExist: false,
            errorText: '',
            connectionError: false,
            entryDataArr: [],
            listObject: null
        }
    }

    clear(): void {
        readline.cursorTo(process.stdout, 0, 0);
        readline.clearScreenDown(process.stdout);
        CONSTANTS.HEAD.forEach(line => console.log(line));
    }

    /**  **************************************************  */
    async init(): Promise<void> {
        UI.Main.init();

        this.clear();
        this.state = this.createNewAppState();

        while (this.state.query == null) {
            await this.setInput();
        }
    
        await this.executePromptFlow();
    }

    async initEventHandlers(): Promise<void> {
        this.eventEmitter.on(this.events.USER_SELECTED_FROM_LIST, async (selectedChoice: string) => {
            // if (selectedChoice.result.pagination) {
            //     this.state.currentPage = (selectedChoice.result.pagination == CONSTANTS.PAGINATIONS.NEXT_PAGE_RESULT_VAL) ?
            //     this.state.currentPage + 1 :
            //     this.state.currentPage - 1;

            //     await this.executePromptFlow();
            // } else if (selectedChoice.result.id == CONSTANTS.PAGINATIONS.SEARCH_RESULT_ID) {
            //     await this.init();
            // } else if (selectedChoice.result.id == CONSTANTS.EXIT.EXIT_RESULT_ID) {
            //     process.exit(0);
            // } else {
            //     await this.promptEntryDetails(Number(selectedChoice.result.id));
            // }
        });

        this.eventEmitter.on(this.events.USER_SELECTED_IN_ENTRY_DETAILS, async (selectedChoice: string) => {
            // if (selectedChoice.result.download) {
            //     await this.download(Number(selectedChoice.result.id));
            // } else {
            //     await this.promptResults();
            // }
        });

        this.eventEmitter.on(this.events.USER_SELECTED_AFTER_DOWNLOAD, async (selectedChoice: string) => {
            // if (selectedChoice.result.id == CONSTANTS.AFTER_DOWNLOAD_QUESTIONS.TURN_BACK_RESULT_ID) {
            //     await this.promptResults();
            // } else {
            //     process.exit(0);
            // }
        });

        this.eventEmitter.on(this.events.USER_SELECTED_AFTER_NORESULT, async (selectedChoice: string) => {
            // if (selectedChoice.result.id == CONSTANTS.AFTER_NORESULT_QUESTIONS.SEARCH_ANOTHER_RESULT_ID) {
            //     await this.init();
            // } else {
            //     process.exit(0);
            // }
        });
    }

    constructURL(pageNumber: number): string {
        let url: string = CONFIG.MIRROR;

        url += `${CONFIG.URL_PARTS.SEARCH_PAGE}?`;

        url += `&${CONFIG.URL_PARTS.PARAMS.QUERY}=${this.state.query}`;
        url += `&${CONFIG.URL_PARTS.PARAMS.PAGE}=${pageNumber}`;
        url += `&${CONFIG.URL_PARTS.PARAMS.PAGE_SIZE}=${CONFIG.RESULTS_PAGE_SIZE}`
        url += `&${CONFIG.URL_PARTS.PARAMS.SORT_MODE}=${CONFIG.URL_PARTS.PARAMS.SORT_MODE_VAL}`;

        return url;
    }

    constructOptions(): UIInterfaces.ListingObject[] {
        let listings: UIInterfaces.ListingObject[] = [];

        listings.push(UIObjects.getOptionListingObject(
            CONSTANTS.PAGINATIONS.SEARCH,
            CONSTANTS.PAGINATIONS.SEARCH_RESULT_ID
        ));

        if (this.state.isNextPageExist) {
            let nextPageURL: string = this.constructURL(this.state.currentPage + 1);
            
            listings.push(UIObjects.getOptionListingObject(
                CONSTANTS.PAGINATIONS.NEXT_PAGE,
                CONSTANTS.PAGINATIONS.NEXT_PAGE_RESULT_VAL,
                nextPageURL
            ));
        }

        if (this.state.currentPage > 1) {
            let prevPageURL: string = this.constructURL(this.state.currentPage - 1);

            listings.push(UIObjects.getOptionListingObject(
                CONSTANTS.PAGINATIONS.PREV_PAGE,
                CONSTANTS.PAGINATIONS.PREV_PAGE_RESULT_VAL,
                prevPageURL
            ));
        }

        listings.push(UIObjects.getOptionListingObject(
            CONSTANTS.EXIT.EXIT,
            CONSTANTS.EXIT.EXIT_RESULT_ID
        ));

        return listings;
    }

    connectionError(): void {
        if (this.spinner.isSpinning()) {
            this.spinner.stop(true);
        }

        console.log(CONSTANTS.CONNECTION_ERROR);
        process.exit(1);
    }

    /**  **************************************************  */
    isSearchInputExistInDocument(document: HTMLDocument): boolean {
        const searchInput = document.querySelector(Selectors.CSS_SELECTORS.SEARCH_INPUT);
        return (searchInput) ? true : false;
    }

    async isNextPageExist(): Promise<boolean> {
        let nextPageURL: string = this.constructURL(this.state.currentPage + 1);
        let document: HTMLDocument = await this.getDocument(nextPageURL);

        let entryAmount: number = document.querySelectorAll(Selectors.CSS_SELECTORS.ROW).length;

        return (entryAmount > 1) ? true : false;
    }

    /**  **************************************************  */
    async setInput(): Promise<void> {
        let inputObject: UIInterfaces.promptObject = {
            type: 'input',
            text: UI.outputs.SEARCH
        }

        let input: string = await UI.Main.prompt(inputObject);

        if (input.trim().length < CONFIG.MIN_INPUTLEN) {
            console.log(CONSTANTS.INPUT_MINLEN_WARNING);
        } else {
            this.state.query = encodeURIComponent(input);
        }
    }

    async setEntries(): Promise<void> {
        this.spinner.setSpinnerTitle(CONSTANTS.SPINNER.GETTING_RESULTS);
        this.spinner.start();

        this.state.url = this.constructURL(this.state.currentPage);
        let document: HTMLDocument = await this.getDocument(this.state.url);

        if (!this.isSearchInputExistInDocument(document)) {
            this.state.connectionError = true;
            this.connectionError();
        }

        let entryData: Interfaces.Entry[] = Entries.getAllEntries(document);
        this.state.entryDataArr = entryData;

        this.state.isNextPageExist = await this.isNextPageExist();
    }

    /**  **************************************************  */
    async getResponse(url: string): Promise<Response> {
        let response: Response = new Response();

        try {
            response = await fetch(url);
        } catch(error) {
            this.state.connectionError = true;
            this.state.errorText = error;
        }

        return response;
    }

    async getDocument(url: string): Promise<HTMLDocument> {
        let response: Response = await this.getResponse(url) || new Response();

        if (this.state.connectionError) {
            this.connectionError();
        }

        let plainText: string = await response.text();

        return new JSDOM(plainText).window.document;
    }

    /**  **************************************************  */
    async constructDownloadEndpoint(entry: Interfaces.Entry): Promise<string> {
        let md5ReqURL: string = CONSTANTS.MD5_REQ_PATTERN.replace('{ID}', entry.ID);
        let md5Response: Response = await this.getResponse(md5ReqURL) || new Response();

        if (this.state.connectionError) {
            this.connectionError();
        }

        let md5ResponseJson: [ {md5: string} ] = await md5Response.json();
        let entrymd5: string = md5ResponseJson[0].md5;
        
        let mirrorURL: string = CONSTANTS.MD5_DOWNLOAD_PAGE_PATTERN.replace('{MD5}', entrymd5);
        let mirrorDocument: HTMLDocument = await this.getDocument(mirrorURL);

        let downloadEndpoint: string = Entries.getDownloadURL(mirrorDocument);

        return downloadEndpoint;
    }

    async download(entryIndex: number): Promise<void> {
        this.spinner.setSpinnerTitle(CONSTANTS.SPINNER.CONNECTING_MIRROR);
        this.spinner.start();

        let selectedEntry: Interfaces.Entry = this.state.entryDataArr[entryIndex];

        let downloadEndPoint: string = await this.constructDownloadEndpoint(selectedEntry);

        let downloadResponse: Response = await this.getResponse(downloadEndPoint);

        if (this.state.connectionError) {
            this.connectionError();
        }
        
        let fileAuthor: string = selectedEntry.Author;
        let fileTitle: string = selectedEntry.Title;
        let fileExtension: string = selectedEntry.Ext;
        
        let fileName: string = (`${fileAuthor} ${fileTitle}`).replace(CONSTANTS.STRING_REPLACE_REGEX,"");
        fileName = fileName.split(' ').join('_');

        let fullFileName: string = `./${fileName}.${fileExtension}`;

        let file: fs.WriteStream = fs.createWriteStream(fullFileName);

        let progressBar = new ProgressBar(CONSTANTS.PROGRESS_BAR.TITLE, {
            width: CONSTANTS.PROGRESS_BAR.WIDTH,
            complete: CONSTANTS.PROGRESS_BAR.COMPLETE,
            incomplete: CONSTANTS.PROGRESS_BAR.INCOMPLETE,
            renderThrottle: CONSTANTS.PROGRESS_BAR.RENDER_THROTTLE,
            total: parseInt(downloadResponse.headers.get('content-length') || '0')
        });

        this.spinner.stop(true);
        
        console.log(CONSTANTS.DIRECTORY_STRING, process.cwd());
        
        downloadResponse.body.on('data', chunk => {
            progressBar.tick(chunk.length);
        });
        
        downloadResponse.body.on('finish', async () => {
            this.promptAfterDownload(fileName, fileExtension);
        });
        
        downloadResponse.body.on('error', this.connectionError);
        
        downloadResponse.body.pipe(file);
    }

    /**  **************************************************  */
    async promptResults(): Promise<void> {
        this.clear();

        let listObject: UIInterfaces.ListObject = UIObjects.getListObject(this.state.entryDataArr, this.state.currentPage);
        let paginationQuestionChoices: UIInterfaces.ListingObject[] = this.constructOptions();

        if (paginationQuestionChoices.length > 0) {
            listObject.listings = [ ... paginationQuestionChoices, ...listObject.listings];
        }

        this.state.listObject = listObject;

        let selectedChoice: string = await UI.Main.prompt(this.state.listObject);

        this.eventEmitter.emit(this.events.USER_SELECTED_FROM_LIST, selectedChoice);
    }

    async promptEntryDetails(entryIndex: number): Promise<void> {
        this.clear();

        let selectedEntry: Interfaces.Entry = this.state.entryDataArr[entryIndex];
        let outputArr: string[] = Entries.getDetails(selectedEntry);

        outputArr.forEach(output => console.log(output));

        let detailsListObject: UIInterfaces.ListObject = UIObjects.getEntryDetailsListObject(entryIndex);

        let selectedChoice: string = await UI.Main.prompt(detailsListObject);

        this.eventEmitter.emit(this.events.USER_SELECTED_IN_ENTRY_DETAILS, selectedChoice);
    }

    async promptAfterDownload(fileName: string, fileExtension: string): Promise<void> {
        console.log(CONSTANTS.DOWNLOAD_COMPLETED, fileName, fileExtension);

        let afterDownloadListObject: UIInterfaces.ListObject = UIObjects.getAfterDownloadListObject();

        let selectedChoice: string = await UI.Main.prompt(afterDownloadListObject);

        this.eventEmitter.emit(this.events.USER_SELECTED_AFTER_DOWNLOAD, selectedChoice);
    }

    /**  **************************************************  */
    async executePromptFlow(): Promise<void> {
        this.state.connectionError = false;

        await this.setEntries();

        if (this.state.connectionError) {
            this.connectionError();
        }

        this.spinner.stop(true);

        if (this.state.entryDataArr.length > 0) {
            this.promptResults();
        } else {
            console.log(CONSTANTS.NO_RESULT);

            let afterNoResultListObject: UIInterfaces.ListObject = UIObjects.getAfterNoResultListObject();

            let selectedChoice: string = await UI.Main.prompt(afterNoResultListObject);

            this.eventEmitter.emit(this.events.USER_SELECTED_AFTER_NORESULT, selectedChoice);
        }
    }
}
