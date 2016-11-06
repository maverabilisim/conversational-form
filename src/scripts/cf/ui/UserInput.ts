/// <reference path="BasicElement.ts"/>
/// <reference path="control-elements/ControlElements.ts"/>
/// <reference path="../logic/FlowManager.ts"/>

// namespace
namespace cf {
	// interface

	export interface InputKeyChangeDTO{
		dto: FlowDTO,
		keyCode: number,
		inputFieldActive: boolean
	}

	export const UserInputEvents = {
		SUBMIT: "cf-input-user-input-submit",
		//	detail: string

		KEY_CHANGE: "cf-input-key-change",
		//	detail: string

		CONTROL_ELEMENTS_ADDED: "cf-input-control-elements-added",
		//	detail: string
	}

	// class
	export class UserInput extends BasicElement {
		public static ERROR_TIME: number = 2000;
		public el: HTMLElement;

		private inputElement: HTMLInputElement;
		private submitButton: HTMLButtonElement;
		private windowFocusCallback: () => void;
		private flowUpdateCallback: () => void;
		private inputInvalidCallback: () => void;
		private onControlElementSubmitCallback: () => void;
		private onSubmitButtonClickCallback: () => void;
		private onControlElementProgressChangeCallback: () => void;
		private errorTimer: number = 0;
		private shiftIsDown: boolean = false;
		private keyUpCallback: () => void;
		private keyDownCallback: () => void;

		private controlElements: ControlElements;
		private currentTag: ITag | ITagGroup;

		private set disabled(value: boolean){
			if(value)
				this.el.setAttribute("disabled", "disabled");
			else
				this.el.removeAttribute("disabled");
		}

		constructor(options: IBasicElementOptions){
			super(options);

			this.el.setAttribute("placeholder", Dictionary.get("input-placeholder"));
			this.inputElement = this.el.getElementsByTagName("input")[0];

			//<cf-input-control-elements> is defined in the ChatList.ts
			this.controlElements = new ControlElements({
				el: <HTMLElement> this.el.getElementsByTagName("cf-input-control-elements")[0]
			})

			// setup event listeners
			
			this.windowFocusCallback = this.windowFocus.bind(this);
			window.addEventListener('focus', this.windowFocusCallback, false);

			this.keyUpCallback = this.onKeyUp.bind(this);
			document.addEventListener("keyup", this.keyUpCallback, false);

			this.keyDownCallback = this.onKeyDown.bind(this);
			document.addEventListener("keydown", this.keyDownCallback, false);

			this.flowUpdateCallback = this.onFlowUpdate.bind(this);
			document.addEventListener(FlowEvents.FLOW_UPDATE, this.flowUpdateCallback, false);

			this.inputInvalidCallback = this.inputInvalid.bind(this);
			document.addEventListener(FlowEvents.USER_INPUT_INVALID, this.inputInvalidCallback, false);

			this.onControlElementSubmitCallback = this.onControlElementSubmit.bind(this);
			document.addEventListener(ControlElementEvents.SUBMIT_VALUE, this.onControlElementSubmitCallback, false);

			this.onControlElementProgressChangeCallback = this.onControlElementProgressChange.bind(this);
			document.addEventListener(ControlElementEvents.PROGRESS_CHANGE, this.onControlElementProgressChangeCallback, false);

			this.submitButton = <HTMLButtonElement> this.el.getElementsByTagName("cf-input-button")[0];
			this.onSubmitButtonClickCallback = this.onSubmitButtonClick.bind(this);
			this.submitButton.addEventListener("click", this.onSubmitButtonClickCallback, false);
		}

		public getInputValue():string{
			return this.inputElement.value;
		}

		public getFlowDTO():FlowDTO{
			let value: FlowDTO;// = this.inputElement.value;

			// check for values on control elements as they should overwrite the input value.
			if(this.controlElements && this.controlElements.active){
				value = <FlowDTO> this.controlElements.getDTO();
			}else{
				value = <FlowDTO> {
					text: this.getInputValue()
				};
			}

			value.input = this;

			return value;
		}

		private windowFocus(event: Event){
			this.inputElement.focus();
		}

		private inputInvalid(event: CustomEvent){
			ConversationalForm.illustrateFlow(this, "receive", event.type, event.detail);
			const dto: FlowDTO = event.detail;

			this.inputElement.setAttribute("data-value", this.inputElement.value);
			this.inputElement.value = "";

			this.el.setAttribute("error", "");
			this.disabled = true;
			// cf-error
			this.inputElement.setAttribute("placeholder", dto.errorText || this.currentTag.errorMessage);
			clearTimeout(this.errorTimer);

			this.errorTimer = setTimeout(() => {
				this.disabled = false;
				this.el.removeAttribute("error");
				this.inputElement.value = this.inputElement.getAttribute("data-value");
				this.inputElement.setAttribute("data-value", "");
				this.inputElement.setAttribute("placeholder", Dictionary.get("input-placeholder"));
				this.inputElement.focus();
			}, UserInput.ERROR_TIME);
		}

		private onFlowUpdate(event: CustomEvent){
			ConversationalForm.illustrateFlow(this, "receive", event.type, event.detail);

			// animate input field in
			if(!this.el.classList.contains("animate-in"))
				this.el.classList.add("animate-in")

			this.currentTag = <ITag | ITagGroup> event.detail;

			this.el.setAttribute("tag-type", this.currentTag.type);
			clearTimeout(this.errorTimer);
			this.el.removeAttribute("error");
			this.inputElement.setAttribute("data-value", "");
			this.inputElement.value = "";
			this.inputElement.setAttribute("placeholder", Dictionary.get("input-placeholder"));
			this.resetValue();
			this.inputElement.focus();
			this.controlElements.reset();

			if(this.currentTag.type == "group"){
				this.buildControlElements((<ITagGroup> this.currentTag).elements);
			}else{
				this.buildControlElements([this.currentTag]);
			}

			setTimeout(() => {
				this.disabled = false;
			}, 1000)
		}

		private onControlElementProgressChange(event: CustomEvent){
			const status: string = event.detail;
			this.disabled = status == ControlElementProgressStates.BUSY;
		}

		private buildControlElements(tags: Array<ITag>){
			this.controlElements.buildTags(tags);
		}

		private onControlElementSubmit(event: CustomEvent){
			ConversationalForm.illustrateFlow(this, "receive", event.type, event.detail);

			// when ex a RadioButton is clicked..
			const controlElement: IControlElement = <IControlElement> event.detail;

			this.controlElements.updateStateOnElements(controlElement);

			this.doSubmit();
		}

		private onSubmitButtonClick(event: MouseEvent){
			this.onEnterOrSubmitButtonSubmit();
		}

		private onKeyDown(event: KeyboardEvent){
			if(event.keyCode == 16)
				this.shiftIsDown = true;
		}

		private onKeyUp(event: KeyboardEvent){
			if(event.keyCode == 16)
				this.shiftIsDown = false;

			if(event.keyCode == 9){
				// tab key pressed, check if node is child of CF, if then then reset focus to input element

				var doesKeyTargetExistInCF: boolean = false;
				var node = (<HTMLElement> event.target).parentNode;
				while (node != null) {
					if (node === window.ConversationalForm.el) {
						doesKeyTargetExistInCF = true;
						break;
					}
					node = node.parentNode;
				}
				
				// prevent normal behaviour, we are not here to take part, we are here to take over!
				if(!doesKeyTargetExistInCF){
					event.preventDefault();
					if(this.shiftIsDown){
						// highlight the last item in controlElement
						if(this.controlElements.active)
							this.controlElements.setFocusOnElement(-1);
						else
							this.inputElement.focus();
					}else{
						this.inputElement.focus();
					}
				}
			}

			if(this.el.hasAttribute("disabled"))
				return;

			const value: FlowDTO = this.getFlowDTO();

			if(event.keyCode == 13 || event.keyCode == 32){
				// ENTER (13) and SPACE (32) key
				if(event.keyCode == 13 && this.inputElement === document.activeElement){
					if(this.controlElements.active){
						// if no highlighted element, then just standard behaviour
						if(!this.controlElements.canClickOnHighlightedItem()){
							this.onEnterOrSubmitButtonSubmit();
						}
					}else{
						this.onEnterOrSubmitButtonSubmit();
					}
				}
				else{
					// either click on submit button or do something with control elements
					if(event.keyCode == 13)
						this.submitButton.click();
					else if(event.keyCode == 32 && document.activeElement)
						(<any> document.activeElement).click();
				}
			}else{
				ConversationalForm.illustrateFlow(this, "dispatch", UserInputEvents.KEY_CHANGE, value);
				document.dispatchEvent(new CustomEvent(UserInputEvents.KEY_CHANGE, {
					detail: <InputKeyChangeDTO> {
						dto: value,
						keyCode: event.keyCode,
						inputFieldActive: this.inputElement === document.activeElement
					}
				}));
			}
		}

		private onEnterOrSubmitButtonSubmit(){
			// we need to check if current tag is file
			if(this.currentTag.type == "file"){
				// trigger <input type="file"
				(<UploadFileUI> this.controlElements.getElement(0)).triggerFileSelect();
			}else{
				// for groups, we expect that there is always a default value set
				this.doSubmit();
			}
		}

		private doSubmit(){
			const value: FlowDTO = this.getFlowDTO();

			this.disabled = true;
			this.el.removeAttribute("error");
			this.inputElement.setAttribute("data-value", "");

			ConversationalForm.illustrateFlow(this, "dispatch", UserInputEvents.SUBMIT, value);
			document.dispatchEvent(new CustomEvent(UserInputEvents.SUBMIT, {
				detail: value
			}));
		}

		private resetValue(){
			this.inputElement.value = "";
		}

		public dealloc(){
			window.removeEventListener('focus', this.windowFocusCallback, false);
			this.windowFocusCallback = null;

			document.removeEventListener("keydown", this.keyDownCallback, false);
			this.keyDownCallback = null;

			document.removeEventListener("keyup", this.keyUpCallback, false);
			this.keyUpCallback = null;

			document.removeEventListener(FlowEvents.FLOW_UPDATE, this.flowUpdateCallback, false);
			this.flowUpdateCallback = null;

			document.removeEventListener(FlowEvents.USER_INPUT_INVALID, this.inputInvalidCallback, false);
			this.inputInvalidCallback = null;

			document.removeEventListener(ControlElementEvents.SUBMIT_VALUE, this.onControlElementSubmitCallback, false);
			this.onControlElementSubmitCallback = null;

			this.submitButton = <HTMLButtonElement> this.el.getElementsByClassName("cf-input-button")[0];
			this.submitButton.removeEventListener("click", this.onSubmitButtonClickCallback, false);
			this.onSubmitButtonClickCallback = null;

			super.dealloc();
		}

		// override
		public getTemplate () : string {
			return `<cf-input>
				<cf-input-control-elements>
					<cf-list-button class="hide" direction="prev">
					</cf-list-button>
					<cf-list-button class="hide" direction="next">
					</cf-list-button>
					<cf-list>
						<cf-info></cf-info>
					</cf-list>
				</cf-input-control-elements>

				<cf-input-button class="cf-input-button" tabindex="2">
					<svg class="cf-icon-progress" viewBox="0 0 24 22" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g fill="#B9BCBE"><polygon transform="translate(12.257339, 11.185170) rotate(90.000000) translate(-12.257339, -11.185170) " points="10.2587994 9.89879989 14.2722074 5.85954869 12.4181046 3.92783101 5.07216899 11.1851701 12.4181046 18.4425091 14.2722074 16.5601737 10.2587994 12.5405503 19.4425091 12.5405503 19.4425091 9.89879989"></polygon></g></g></svg>

					<svg class="cf-icon-attachment" viewBox="0 0 24 22" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g><g transform="translate(-1226.000000, -1427.000000)"><g transform="translate(738.000000, 960.000000)"><g transform="translate(6.000000, 458.000000)"><path stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" d="M499,23.1092437 L499,18.907563 C499,16.2016807 496.756849,14 494,14 C491.243151,14 489,16.2016807 489,18.907563 L489,24.5042017 C489,26.4369748 490.592466,28 492.561644,28 C494.530822,28 496.123288,26.4369748 496.123288,24.5042017 L496.123288,18.907563 C496.140411,17.7478992 495.181507,16.8067227 494,16.8067227 C492.818493,16.8067227 491.859589,17.7478992 491.859589,18.907563 L491.859589,23.1092437" id="Icon"></path></g></g></g></g></svg>
				</cf-input-button>
				
				<input type='input' tabindex="1">

			</cf-input>
			`;
		}
	}
}