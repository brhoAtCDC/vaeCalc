

/***************************************************************************************************************

Ventilator-Associated Event Calculator
written by 

Barry Rhodes, Ph.D. 
Development Team Lead
Division of Healthcare Quality Promotion 
NCEZID, CDC  
brhodes@cdc.gov

Copyright 2014 Barry Rhodes

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Questions or comments should be directed to me at the address above.

Barry


Change Log:
******************************************
01/14/2013 Fixed peep values to accept zeros.
01/22/2013 Fixed drug columns so that if user chooses more than one column with the same drug in each column, users gets an alert box
01/26/2013 Fixed spelling errors oxigenation -> oxygenation
02/06/2013 Fixed NextDay function to work around last day of daylight savings time (Nov 4, 2012)
04/10/2013 Changed the PEEP definition to exclude values < 5
04/10/2013 Changed "and" to "or" in the directions "Now that an VAC has been found, enter....
04/10/2013 Using the community hosted versions of jQuery, jQuery UI and jQuery UI css
04/10/2013 .live method is deprecated in jQuery 1.9 so chaged it to .on
04/15/2013 calculates multiple VAEs in one episode of care
04/16/2013 added print functionality
05/07/2013 fixed resetVAcDaylabel to reset when IVAC is clicked a second time and the VAE event reverts back to VAC
05/15/2013 allow user to change values after clicking a calculate X button.  if a change is made after calculating a VAE
			then the determination will rever back to the previous type and allow the user to recalculate.
07/15/2013 changed >14 to >= 14 day rule
12/16/2013 changed the drug list as per the new protocol incremented the version to 2.1
12/18/2013 changed the vaeEvents object to include vacDeterminedBy, changed the vac explanations to be more detailed
02/20/2014 fixed a bug when both FIO2 and PEEP values meet the VAC criteria on the same day.  It was counting this as two events when it should only be one.
10/7/2014 Added a new drug as per the Jan 2015 release of NHSN
10/7/2014 Major changes to probable and possible PVAP which converged into a single PVAP as per the 2015 changes to the VAE protocol

*******************************************



*****************************************************************************************************************/
//Some Global vars and objects 
	var IVACCols = false;  //flag for whether the IVAC columns are being shown or not
	var vacDay = 0;  //deprecated      // global var that stores the day of the VAC.  This index starts at 1 and increments from there
	var vacDays = [];  //this stores an array of indexes of vacDays
	
	
	function vaeEvents(eventDays, types, windowStartDay, windowStopDay, hasVAPBeenDetermined, vacDeterminedBy) {
		this.eventDays=eventDays;  //array of days on which a VAE event is noted  index starts at 1
		this.types=types;  //array values are VAC, ICAC ProbVAP PossVAP
		this.windowStartDay = windowStartDay;
		this.windowStopDay = windowStopDay;
		this.hasVAPBeenDetermined = hasVAPBeenDetermined;  //array of bools that tell whether a PVAP has been determined
		this.vacDeterminedBy = vacDeterminedBy;  // values are PEEP or FiO2
	}
	
	var vae = new vaeEvents([], [], [], [], [], []);  //a global object of event days and types
	
	//first define a return object for getVAECandidate()
	function retObj(index, foundOne) {
		this.index=index;  //array of days on which a VAE event is noted  index starts at 1
		this.foundOne=foundOne;  //array values are VAC, ICAC ProbVAP PossVAP
	}

	
	
	var vaeWindowStartDay = 0;  //defines the vae Window
	var vaeWindowStopDay = 0
	var tabIndex = 6;      //global to increment the tabindex on the drug column as more columns are added this value is incremented

	var drugColIndex= -1; // counts the number of drug columns present and visible on the screen

	var drugColVis = new Array();  //since users can delete drug columns we need to track which ones are vis and which ones are not values are true or false
					// the length of an array is drugColVis.length
	var MVDates = new Array();  // This holds the date strings for all the MV days
	var MVDays  = new Array();
	
	var explanation = ""; //stores the explanation of the algorithm
	var direction   = "";  //store the directions for the input or statement of output
	
	var mvDay1 = new Date();  //stores the first day of mechanical intubation
	var mvDayOffset = 0;  //stores the number of days between the fist day of intubation and the first day of the episode interval
	var mvDaysFromToday = 0;  //stores the number of days between today and the fist day of intubation 
	var hasVACbeenCalculated = false;
	var hasIVACbeenCalculated = false;
	var LINE = '<br>__________________________________________<br>';
	
	var PEEP = 'PEEP';
	var FIO2 = 'FiO2';
	
	var today = new Date();


//Main entry into jQuery allows calls only after the page has fully loaded

$(document).ready(function(){
//All the elements are initially hidden in the css.  This is so that if a user does not have js on, then the browser will not show the elements
//As long as js is turned on, then the script will show them as needed

	$('#buttonDiv').show();
	// hide the button(s) for now 
	$('#IVAC').hide();
	$('.IVACCalc').hide();
	//$('#addDrugCol').hide();
	$('#theTable').hide();
	$('#PVAP').hide();
	$('#calcPVAP').hide();
	$("#nextIVAC").hide();
	$('#cancelPVAP').hide();
	$('.reset').hide();
	//dont show these buttons yet.  Only allow to be shown after a VAC determination is made

	$('#hidePeepCol').hide();
	$('#hideFio2Col').hide();
	$('#explain').hide();
	$('.calcVAC').hide();
	
	$('#legendTable').hide();
	$('#datePickerDiv').show();
	
	$('#msgBox').hide();
	$('#peepLegend').hide();
	$('#less').hide();
	
	
	
	//set the footer width to the bigDiv width
	$("#footer").width($("#bigDiv").width() + 44);
	
	direction = "<p>Welcome to version 3.0 of the Ventilator-Associated Event Calculator. Version 3.0 operates based \
	upon the currently posted (January 2015) VAE protocol.  For periods of time where \
	a patient is on APRV or a related type of mechanical ventilation for a full calendar day, a daily minimum \
	PEEP value should not be entered into the calculator.  Additionally the calculator finds multiple VAEs per patient as long as they \
	conform to the 14 day rule. It is strongly encouraged that you read and study the VAE protocol found \
	<a href='http://www.cdc.gov/nhsn/acute-care-hospital/vae/index.html' target='_blank'>here</a>.</p> \
	<p>To get started, enter a date below that corresponds to the first day the patient was placed on mechanical  \
	ventilation during the mechanical ventilation episode of interest. You may type in a date or use the popup \
	calendar when it appears. You may only enter dates within the past year. If the patient has been on mechanical \
	ventilation for more than one year during the current mechnaical ventilation episode, choose a start date \
	that is more recent but is at least 7 days before the period of interest.";
	
	
	
	direction += "<span id='more';  style='color:blue;'> more...</span> <p id='moreText' style='display: none;'> \
	The calculator runs locally on your machine so no data are reported anywhere. Feel free to enter \
	or change as much data as you like. If you don't understand something there are several mechanisms for getting \
	help. Most of the buttons and table headings will give an expanded description if you hover your mouse over the \
	item in question. Also the explain button will pop up an explanation of the reasoning behind the calculator. The\
	explanation box is movable as are all the popup windows. That allows you to open one up and drag it to the side\
	as you work. The explanation will automatically update itself as you work through the protocol.</p>\
	<span id='less';  style='color:blue;'> less...</span> ";
	
	/********
	direction = "<p>Welcome to version 3.0 of the Ventilator-Associated Event Calculator. Version 3.0 operates based \
	upon the currently posted (January 2015) VAE protocol. The list of eligible antimicrobial agents for use\
	in meeting the IVAC definition has been refined.   As a reminder, the calculator recognizes PEEP values &le; 5\
	and corrects entries according to the VAE protocol prior to making a VAC determination. For periods of time where \
	a patient is on APRV or a related type of mechanical ventilation for a full calendar day, a daily minimum \
	PEEP value should not be entered into the calculator.  Additionally the calculator finds multiple VAEs per patient as long as they \
	conform to the 14 day rule. It is strongly encouraged that you read and study the VAE protocol found \
	<a href='http://www.cdc.gov/nhsn/acute-care-hospital/vae/index.html' target='_blank'>here</a>.</p> "
	
	direction += "<span id='more';  style='color:blue;'> more...</span> <p id='moreText' style='display: none;'> \
	The calculator runs locally on your machine so no data are reported anywhere. Feel free to enter \
	or change as much data as you like. If you don't understand something there are several mechanisms for getting \
	help. Most of the buttons and table headings will give an expanded description if you hover your mouse over the \
	item in question. Also the explain button will pop up an explanation of the reasoning behind the calculator. The\
	explanation box is movable as are all the popup windows. That allows you to open one up and drag it to the side\
	as you work. The explanation will automatically update itself as you work through the protocol.</p>\
	<span id='less';  style='color:blue;'> less...</span> ";
	 *********/
	
	showDirection();
	$('#less').hide();
	$('#datePickerDiv').show();

	
	
	
/********************************event handlers ***************************************/
	
	
$('#more').hover(function() {
	$('#more').css('backgroundColor', 'Yellow' );
	$('#more').css('cursor', 'hand' );
		
},
function() {
	$('#more').css('backgroundColor', 'White' );
	}
	
);
	
$('#more').click(function(){
	$('#more').hide();
	//$('#moreText').css('font-weight', 'bold' );
	$('#moreText').show();
	$('#less').show();
	
});
$('#less').click(function(){
	$('#more').show();
	$('#moreText').hide();
	$('#less').hide();
});	

$('#less').hover(function() {
	$('#less').css('backgroundColor', 'Yellow' );
	$('#less').css('cursor', 'hand' );
		
},
function() {
	$('#less').css('backgroundColor', 'White' );
	}
	
);

$(document).on("click", '#addDrugCol',  function() {
	addDrugColumn();
	hasIVACbeenCalculated = false;
});

$('#PVAP').click(function() {
	setVAPDirection();
	showPVAPPage();
	initializeVaeVapFlags();
	explanation = "<h3>Explanation:</h3>";

});

$('#myPrint').click(function() {
	myPrint();
});


$('#hidePeepCol').click(function() {
	$('.peepHeader').hide();
	$('.peepCol').hide();
});
	
$('#hideFio2Col').click(function() {
	$('.fio2Header').hide();
	$('.fio2Col').hide();
});

$('.reset').click(function() {
	var resp;
	resp = confirm("This erases all work and resets the page.  Are you sure you want to do this?");
	if(!resp) return false;
	
	location.reload(true);  //reloads the page note says that this may not work with all browsers.  In FireFox with the true param the page loads from the cache 
	// the true is like a Ctrl F5 which goes to the server rather than using the cached page.  
});

$('#explain').click(function() {
	explain();
});




$('.closeExplainBox').click(function() {
	$('#explainBox').hide();
});

$(document).on("click", '.cb',  function() { 	//the following event handler for all check boxes is solely for printing purposes only
	if($(this).is(':checked') ) $(this).attr('checked', 'checked'); 				//IE will not print check boxes unless their attributes are set to "checked"
	else $(this).removeAttr('checked');
});
$(document).on("click", '.cb2',  function() { 	//the following event handler for all check boxes is solely for printing purposes only
	if($(this).is(':checked') ) $(this).attr('checked', 'checked'); 				//IE will not print check boxes unless their attributes are set to "checked"
	else $(this).removeAttr('checked');
});

$('#calcPVAP').click(function() {

	
	if( !calcPVAP() ) myAlert("Based on your response, this episode should be characterized as an IVAC");
	else $("#pvapBody").html("PVAP Found!");

});

$('#nextIVAC').click(function() {
	 if( !showPVAPPage() ) $('#PVAP').attr('disabled', 'disabled');
});


$('#cancelPVAP').click(function() {
	$("#vapDiv").hide();
	//alert("hiding");
});

//Event handler for the "IVAC" button	
$('#IVAC').click(function() {
	deleteExtraneousRows();
	$('.calcVAC').hide();
	addIVACCols();
});


$('.calcVAC').click(function() {


	if(calcVAC()) {
		shadeVACWindows();
		//show the IVAC button and hide the VAC button
		$('#IVAC').show();	
		hasVACbeenCalculated = true;
	}

	showDirection(); 
	updateMyAlert(explanation);
	
}); 	

//these two functions trigger on a change but only after the element looses focus which produces inconsistent behaviour

//if a user calculates a vac and then makes a change to FIO2 or PEEP values this will restrict the user
//to recalculate the VAC before proceeding
$(document).on("change", "input[name=PEEP]", function() {
	if(hasVACbeenCalculated) resetVAC();
	hasVACbeenCalculated = false;
});

$(document).on("change", "input[name=fio2]", function() {
	if(hasVACbeenCalculated) resetVAC();
	hasVACbeenCalculated = false;
});	


function resetVAC() {
		$('#IVAC').hide();
		clearVAE();
		resetVacDayLabel(true);
		direction = explanation = "You have changed an input value after clicking on the Calculate VAC button. When you are finished making your changes, please recalculate VAC.";
		alert(direction);
		showDirection();

}


//the following event handler catches changes to any checkbox class = 'cb' (all ow which are for IVAC)
$(document).on("change", ".cb", function() {
	if(hasIVACbeenCalculated) resetIVAC();
	hasIVACbeenCalculated = false;
});

function resetIVAC() {
//first reset VAEs to VACs
	for(var i = 0; i < vae.types.length; i++) {
		vae.types[i] = "VAC";
	}
	$('#PVAP').hide();
	resetVacDayLabel();
	clearQADCol();
	$('.IVACCalc').show();  //handles the case where a PVAP was calculated and this was hidden
	
	direction = explanation = "You have changed an input value after clicking on the Calculate IVAC button.  When you are finished making your changes, please recalculate IVAC.";
	alert(direction);  //this may be too annoying
	showDirection();
}



//Event handler for the "deleteDrugCol" button	note that this is a dynamic button added after the page is initally rendered
//so you need to cal the .on function to attach a handler.  Each dynamically created delete button has a value set by drugColIndex
//$('#deleteDrugCol').on("click", function() {
$(document).on("click", '#deleteDrugCol', function() {
	var val = $(this).val();
	//myAlert("In delete drug.  the row is " + val + ".");
	removeDrugColumn(val);
	hasIVACbeenCalculated = false;
});

//Event handler for the Calculate IVAC button
$('.IVACCalc').click(function(event) {
	hasIVACbeenCalculated = true;
	calcIVAC();
});


/*******************************End Event Handlers ***************************************/	

/*******************************Begin Event Handler Functions ****************************/
function explain() {

	
	if( explanation.length == 0) explanation = "No Explanation found";
	
	
	if( !$('#explainBox').is(':visible') ) {  
		//explainBox div is not visible so center the explainBox on bigDiv
		var bigDivTop =  	$('#bigDiv').offset().top;
		var bigDivLeft = 	$('#bigDiv').offset().left;
		var bigDivWidth = 	$('#bigDiv').width();
		var explainBoxWidth = 	400;
		var bigDivHeight = 	Math.min($('#bigDiv').height(), $(window).height()) ;
		var explainBoxHeight = 	200;
		
		var left = Math.max( bigDivLeft +(bigDivWidth - explainBoxWidth)/2, 20);
		var top  = Math.max( bigDivTop +(bigDivHeight - explainBoxHeight)/2, 20);
		
		$('#explainBox').css("top", top );
		//$('#explainBox').css("left", left );
		$('#explainBox').draggable();
		
	} 
	//$('#explainBox').fadeOut('fast');
	//$('#explainBox').fadeIn('fast');
	$('#explainBox').show();

	$('#msg').html(explanation);
	
	
	return true;

}


function myPrint() {
	var content = "",
		vapIsVis = false,
		expIsVis = false;
		
	if( $('#vapConditional').is(':visible') ) {
		content = $('#vapConditional').html();
		vapIsVis = true;
	}
	if( $('#explainBox').is(':visible') ) {
		content += ('<br>' + $('#msg').html());
		expIsVis = true;
	}
	if(vapIsVis || expIsVis) {
		alert('You have an open dialog box.  The contents of the box will be printed at the bottom of the page.');
		if(expIsVis) $('#explainBox').hide();
		if(vapIsVis) $('#vapConditional').hide();
		$('#printBox').show();
		$('#printBox').html(content);	
	}	
	window.print();
	$('#printBox').hide();
	if(expIsVis) $('#explainBox').show();
	if(vapIsVis) $('#vapConditional').show();
	
}



/***************************************End Event Handler Functions ***************************/
$('#datePicker').datepicker({
		   maxDate: today,  onClose: function(datePicked) {

			var ONE_DAY = 1000 * 60 * 60 * 24;
			var totDays = 0;
			var tablerow = "";
			var expl="";

			$('.reset').show();
			
	
			if(datePicked) mvDay1 = new Date(datePicked);  //saves the start date for mechanical ventilation
			else return false;
			
			
			var dateDif = today.getTime() - mvDay1.getTime();

			totDays = Math.ceil(dateDif / ONE_DAY);
			
			if( totDays < 3)
			{
				myAlert("The VAE definition requires at least 4 days of mechanical ventilation to satisfy the VAC Definition and from 6 to 9 days depending on your data to satisfy the definition for an IVAC .  Please choose an appropriate date range.");
				return false;
			}
			else if( totDays < 6)
			{
				myAlert("The VAE definition requires at least 4 days of mechanical ventilation to satisfy the VAC Definition and from 6 to 9 days to satisy the definition for an IVAC depending on your data. ");
			}
			
			if( totDays > 365)
			{
				myAlert("You have chosen more than a year's worth of data.  This may cause your system to run slowly or shut down.  Choose a �start date� that is more recent, but is at least 7 days before the period of interest.");
				return false;
				
			}
			
			
			
			//now figure out the number of days between the MVDay 1 and the first day in the range of the episode
			
			//var mvday  = new Date(mvDay1);
			//var startDay = new Date(dates[0]);
			startDay = mvDay1;
			mvDayOffset = Math.floor( (startDay.getTime() - mvDay1.getTime())/ONE_DAY);
			//myAlert(mvDayOffset);
			
			if( mvDayOffset < 0 )
			{
				var msg = "The starting range you chose is prior to the intubation start date of " + $.datepick.formatDate(mvDay1) + ".  Please choose a start date that is on or after the first day of mechanical ventilation.  ";
				myAlert(msg);
				return false;
			}
			
			//var mvDateOffset = Math.floor( (dates[0].getTime() - mvDay.getTime() )/ONE_DAY );
			//myAlert (mvDateOffset);
			
			//now show the table
			$('#theTable').show();

			

			for( var i = 0; i <= totDays; i++) {
					//myAlert(" Day # = " + i + "  Date is: " + $.datepick.formatDate(startDay) );
					MVDates[i] = formatDate(startDay);  // put the date strings in the MVDates array for display in the MVDates column of the table
					

					MVDays[i] = i+1 + mvDayOffset;  //this compensates if the MV day s before the interval of the episode
					startDay = nextDay(startDay);
					tablerow = "<tr class='inputRow'><td class='mvDay'>" + MVDays[i].toString() + "</td><td class='mvDate'>" + MVDates[i] + "</td> \
					<td class='peepCol'><input type='text' name='PEEP' tabindex=1 size='4' /></td>  \
					<td class='fio2Col'><input type='text' name='fio2' tabindex=2 size='4' /></td><td class='vaeResult'>&nbsp&nbsp&nbsp</td>";
					$('#theTable tr:last').after(tablerow); 

			}
				
			
			//$('#buttonDiv').show();
			$('.calcVAC').show();
			$('#legendTable').show();
			
			if( totDays > 4) $('#buttonDivAtBottom').show();
				
			//hide rangePicker input box
			$('#datePickerDiv').remove();	
			
			
			direction = "Now enter PEEP and/or FiO<sub>2</sub>  values and when done, click the  &#34;Calculate VAC&#34; button. <span class='emphasis'>You do not need to enter data for every day.</span>  Concentrate on the dates where you believe a Ventilator-Associated Event may be likely. If your values meet the Ventilator-Associated Condition (VAC) definition, the event day will be identified and the VAE Window will be defined.  ";

			showDirection();
			
		}

});



//bigDiv is the enclosing div.  As more drug columns are added this incements the width (maybe can use auto stile for this) more research needed

function adjustBigDivWidth()
{
	
	//Make bigDiv wider to accomodate the table
	var tableW = $('#theTable').width() + 40 + "px";
	

	$("#bigDiv").css("width", tableW );

}


// This function is called if a VAC is detected and the user
// wishes to go on to calculate IVAC.  This will add the columns
//  temperature and WBC necessary to calculate IVAC

function addIVACCols()
{
	var vaeDay = 0; //the day of the VAE occurance
	var totDay = 0; //total days on the table

	//set the GLOBAL var IVACCols = true so that the code will not add the fio2 and PEEP columns more than once
	IVACCols = true;
	direction = "Now that a VAC determination has been made, enter yes (check) or no (leave box unchecked) if the patient \
	has had a temperature  &gt; 38&deg C or &lt; 36&deg C or a WBC &#x2265; 12,000 cells/mm<sup>3</sup> or &#x2264; 4,000 cells/mm<sup>3</sup> within the VAE Window Period.  \
	 Choose a drug from the drop down list and <span class='emphasis'>check all the corresponding days shown on the screen</span> that the agent was administered.  If more than one drug was given over the course of treatment, \
	click on the &quot;Add...&quot; button in the drug column header and do the same.  Once all data have been entered, <span class='emphasis'>click the &#34;Calculate IVAC&#34; button.</span>";
	explanation = "Please enter data and click the &#34;Calculate IVAC&#34; button.";
	showDirection();

	//show the IVAC Calculate button
	$('.IVACCalc').show();
	
	//allow the user to hide the PEEP and FiO2 cols if desired to get more screen 

	$('#hidePeepCol').show();
	$('#hideFio2Col').show();

	//done with the move on to IVAC button so hide
	$('#IVAC').hide();

	
	//disable the VAC data entry and buttons since the user is now past that point in the algorithm
	//$('.calcVAC').attr('disabled', 'disabled');
	//or just hide it
	$('.calcVAC').hide();

	var newHeaders = "<th class = 'tempHeader'; style='vertical-align:top;'><span title='Check days in this column for which the patient had a temperature either greater than 38&deg C or less than 36&deg; C.'> T&lt;36&deg or<br>T&gt;38&deg;</span></th><th class='wbcHeader'; style='vertical-align:top;'><span title='Check days in this column for which the patient had a white bloodcell count either less than or equal to 4,000 cells per cubic millimeter or greater than or equal to 12,000 cells per cubic millimeter.'> WBC&le;4,000 or<br>WBC&ge;12,000 cells/mm<sup>3</sup></span> </th>";
	var newIVACCols = "<td class = 'tempCol' align='center'><input type='checkbox' class = 'cb' tabindex=3 /></td><td class = 'wbcCol' align='center'><input type='checkbox' class = 'cb' tabindex=4 /></td>";

	$('.vaeHeader').after(newHeaders );
	
	$(".vaeResult").each(function(index) {
	// add the extra columns for IV	
		$(this).after(newIVACCols);
	});



	//need to add new drug column

	addDrugColumn();
	addQadColumn();

	//disable the VAC values

	$('.calcVAC').attr('disabled', 'disabled');

	$("input[name=fio2]").each( function(index, object) {
	$(this).attr('disabled', 'disabled');
	});

	$("input[name=PEEP]").each( function(index, object) {
	$(this).attr('disabled', 'disabled');
	});

	//finally reshade the VAC Window
	reshadeVAEWindow();
	resetVacDayLabel();
	
}
function disableInput(type) {
	if(type == "VAC") {
		$("input[name=fio2]").each( function(index, object) {
			$(this).attr('disabled', 'disabled');
		});

		$("input[name=PEEP]").each( function(index, object) {
			$(this).attr('disabled', 'disabled');
		});

	}
	if(type == "IVAC") {
	//do sometinh here
	}	

}


function addQadColumn() {

	var qadHeader = "<th class = 'qadHeader'; style='vertical-align:top;'><span title='This column will display any Qualifying Antimicrobial Days determined from your data.'>QAD</span></th>";
	var qadCell   = "</td><td align='center' class = 'QAD'>&nbsp&nbsp&nbsp</td>";
	
	$('.drugHeader').last().after(qadHeader);
	$(".inputRow").each(function(index) {
		$(this).children().last().after(qadCell);
	});	

}



function addDrugColumn()
{
	//increment the drugColIndex
	drugColIndex++;
	drugColVis[drugColIndex] = true;  //this drug column is visible
	//var drugHeaderClass = "drugHeader" + dr;
	var drugColClass  = "drugCol" + drugColIndex;
	
	var drugCol = "<td align='center' class = '" + drugColClass +  "'><input type='checkbox' class = 'cb' tabindex=" + tabIndex++ + " />";
	

	var drugHeader = "<th class='drugHeader'; style='text-align:right; vertical-align:top;'> <button id='addDrugCol' STYLE='font-family : monospace;  font size : 7pt; ' title='Click this button to enter another drug'>&nbsp&nbsp Add...</button><br><button id='deleteDrugCol' STYLE='font-family : monospace;  font size : 7pt; ' title='Click this button to remove this drug.' value ='" + drugColIndex+ "' >Remove...</button> <br><br>";	
	
	drugHeader += "<select id='selectDrug" + drugColIndex + "' STYLE='font-family : monospace;  font size : 8pt' tabindex = " + tabIndex++ + "; > \
<option value='0'>Choose a Drug</option> \
<option>AMIKACIN</option> \
<option>AMPHOTERICIN B </option> \
<option>AMPHOTERICIN B LIPOSOMAL</option> \
<option>AMPICILLIN</option> \
<option>AMPICILLIN/SULBACTAM</option> \
<option>ANIDULAFUNGIN</option> \
<option>AZITHROMYCIN</option> \
<option>AZTREONAM</option> \
<option>CASPOFUNGIN</option> \
<option>CEFAZOLIN</option> \
<option>CEFEPIME</option> \
<option>CEFOTAXIME</option> \
<option>CEFOTETAN</option> \
<option>CEFOXITIN</option> \
<option>CEFTAROLINE</option> \
<option>CEFTAZIDIME</option> \
<option>CEFTIZOXIME</option> \
<option>CEFTRIAXONE</option> \
<option>CEFUROXIME</option> \
<option>CIPROFLOXACIN</option> \
<option>CLARITHROMYCIN</option> \
<option>CLINDAMYCIN</option> \
<option>COLISTIMETHATE</option> \
<option>DORIPENEM</option> \
<option>DOXYCYCLINE</option> \
<option>ERTAPENEM</option> \
<option>FLUCONAZOLE</option> \
<option>FOSFOMYCIN</option> \
<option>GEMIFLOXACIN</option> \
<option>GENTAMICIN</option> \
<option>IMIPENEM/CILASTATIN</option> \
<option>ITRACONAZOLE</option> \
<option>LEVOFLOXACIN</option> \
<option>LINEZOLID</option> \
<option>MEROPENEM</option> \
<option>METRONIDAZOLE</option> \
<option>MICAFUNGIN</option> \
<option>MINOCYCLINE</option> \
<option>MOXIFLOXACIN</option> \
<option>NAFCILLIN</option> \
<option>OSELTAMIVIR</option> \
<option>OXACILLIN</option> \
<option>PENICILLIN G</option> \
<option>PIPERACILLIN</option> \
<option>PIPERACILLIN/TAZOBACTAM</option> \
<option>POLYMYXIN B</option> \
<option>POSACONAZOLE</option> \
<option>QUINUPRISTIN/DALFOPRISTIN</option> \
<option>RIFAMPIN</option> \
<option>SULFAMETHOXAZOLE/TRIMETHOPRIM</option> \
<option>SULFISOXAZOLE</option> \
<option>TEDIZOLID</option> \
<option>TELAVANCIN</option> \
<option>TELITHROMYCIN</option> \
<option>TETRACYCLINE</option> \
<option>TICARCILLIN/CLAVULANATE</option> \
<option>TIGECYCLINE</option> \
<option>TOBRAMYCIN</option> \
<option>VANCOMYCIN (intravenous only)</option> \
<option>VORICONAZOLE</option> \
<option>ZANAMIVIR</option> \
</select></th>";


	//find the last drug column and put this one after it
	var maxIndex = 0;
	
	for( var i = 0; i < drugColIndex; i++) {
		if( drugColVis[drugColIndex]) maxIndex = drugColIndex;
	}
	if(maxIndex == 0) $('.wbcHeader').after(drugHeader);//put the first column after the wbc column
	else $('.drugHeader').last().after(drugHeader);
	
	
		
	$(".inputRow").each(function(index)
	{	
		if(maxIndex == 0) $(this).children().last().after(drugCol);  //inset into last cell in row
		else {
		$(this).children().last().before(drugCol);  //insert into next to last cell in row
			explanation = "A new drug has been added so a new IVAC determination must be made. Please click on &quot;Calculate IVAC&quot; when you are ready.  ";
			direction = "A new drug has been added so please click on &quot;Calculate IVAC&quot; when you are ready.  ";
			showDirection();
			updateMyAlert(explanation);
			clearQADCol();
		}
	});	
	
	//increase the bigDiv width to enclose the new table

	adjustBigDivWidth();	

	//finally reshade the VAC Window
	reshadeVAEWindow();
	resetVacDayLabel();

	$('#PVAP').hide();
	



}




//This function removes the drug column.  The param passed to it is the column number
function removeDrugColumn(col)
{
	//disable the explain button since there is not yet anythong to explain
	//$('#explain').attr('disabled', 'disabled');
	
	var count = 0;  // counts the number of drug columns visible
	var resp;

	//first count the # of drug columns showing
	for( i = 0; i < drugColVis.length; i++)
	{
		if(drugColVis[i]) count++;
	}
	if(count <= 1)
	{
		resp =  alert("You need at least one drug administered to make an IVAC determination.  Are you sure you want to do this?");
		return false;
	}


	//remove the 
	var drugID = "#selectDrug" + col;
	var drugCol = ".drugCol" + col;

	$(drugID).parent().remove();
	$(drugID).remove();
	$(drugCol).remove();
	
	drugColVis[col] = false;  //this is no longer visible


	//now the drug column has been removed so we need to recalculate the iVAC def

	
	direction = "A drug column has been removed so please click on Calculate IVAC when you are ready.  ";
	explanation = "A drug column has been removed.  An new explanation will be determined after you click on &quot;Calculate IVAC&quot; again.   ";
	showDirection();
	updateMyAlert(explanation);
	$('#PVAP').hide();
	adjustBigDivWidth();

}


//this function replaces the text in the vacDay table cell 
// without params this defauts to empty and transparent

function resetVacDayLabel(erase)
{
	var color = 'yellow';
	if(erase) color = "transparent";
	var blank = "&nbsp&nbsp&nbsp";
	var label = "";
	
	//if(!msg) msg = 
	for(var i = 0; i < vae.eventDays.length; i++) {
		$('.mvDay').each(function(index) {
			var mvDay = parseInt($(this).text());
			if( mvDay == vae.eventDays[i]) {
				$(this).siblings('.vaeResult').css("background-color", color);
				if(erase) label = blank;
				else label = vae.types[i];
				$(this).siblings('.vaeResult').last().html(label);
				//continue;
			}
		});
	}
}


function calcIVAC() {

	
	//clear the QAD column of any previous results
	clearQADCol();
	var foundAtLeastOneIVAC = 0;
	var retVal;
	//enable the explain button
	$('#explain').removeAttr('disabled');
	
	explanation = '<h3>Explanation</h3>';
	direction = '';
	
	for( var k = 0; k < vae.types.length; k++ ) {
		//do this for each vac found
		qadExplanation = '';
		var isTemp = isTempCheckedInVAEWindow(k);
		var isWBC = isWBCCheckedInVAEWindow(k);
		var vacDate = getMVDate(vae.eventDays[k]);
		//explanation += LINE;
		if(isTemp || isWBC) {
			
			
			if(isTemp) 	explanation += "<p>A temperature box is checked within the VAE Window for the VAE on " + vacDate  + " so this meets the first part of the IVAC definition.</p>  ";
			else explanation += "<p>A WBC box is checked within the VAE Window for the VAE on " +   vacDate + " so this meets the first part of the IVAC definition.</p>  ";
			
			retVal = areFourQADSInARow(k);
			if(retVal.foundIVAC) {
				vae.types[k] = 'IVAC';
				
				explanation += "<p>For the VAE on " + vacDate  + " There are at least 4 Qualifying Antimicrobial Days.  Therefore this is an IVAC.</p>";
				explanation += ('<p>' + retVal.msg + '</p>');
				foundAtLeastOneIVAC++;
			}
			else if(!retVal.drugChosen){
				myAlert('Please select a drug from the dropdown list.');
				return;
			}
			else if (retVal.duplicateDrug) {
				myAlert('You have chosen the same drug in more than one column.');
				return;
			}
			else {
				vae.types[k] = 'VAC';
				vae.hasVAPBeenDetermined[k] = 'NA';
				explanation += "<p>Although the Temp. or WBC portion of the IVAC definition was met for the VAE on " + vacDate  + " There were not 4 Qualifying Antimicrobial Days in a row with a new drug start with the VAE window.  Therefore this is not an IVAC but remains a VAC event.</p>";
				explanation += ('<p>' + retVal.msg + '</p>');
			}
		}
		else explanation += "<p>In order to qualify as an IVAC for the VAC on " + vacDate + ", the patient must have a temperature or white blood cell count that conforms to the column headings within the VAE Window Period.</p>";

	}
	if(foundAtLeastOneIVAC) {
		$('#PVAP').show();  //show the VAP button now
		if(foundAtLeastOneIVAC == 1) direction += '<p>An IVAC was found for this patient.  Click on the &quot;Go To PVAP&quot; button to go to the next part of the definition or click on the &quot;Explain...&quot; button for an explanation of how this determination was made.</p>';
		//bug here vae.types.length gives all vaes and this should be only IVACs
		var c = getNumberOfIVACs();
		if(foundAtLeastOneIVAC > 1)  direction += '<p>' +  c.toString() + ' IVACs were found for this patient.  Click on the &quot;Go To PVAP&quot; button to go to the next part of the definition or click on the &quot;Explain...&quot; button for an explanation of how this determination was made.</p>';
	}
	else {
			$('#PVAP').hide();
			if(vae.types.length == 1) direction += '<p>No IVACs were found for this patient.  You should report the event as a VAC. Click on the &quot;Explain...&quot; button for an explanation of how this determination was made.</p>';
			else direction += '<p>No IVACs were found for this patient.  You should report all the events as a VACs.  Click on the &quot;Explain...&quot; button for an explanation of how these determinations were made.</p>';
	}
	
	resetVacDayLabel();
	showDirection();
	updateMyAlert(explanation);		

}
function getNumberOfIVACs() {
	var count = 0;
	for(var i = 0; i < vae.types.length; i++) {
		if(vae.types[i] == 'IVAC') count++;
	}
	return count;
}


function isTempCheckedInVAEWindow(e) {  //e is the event index
	var start = vae.windowStartDay[e];
	var stop = vae.windowStopDay[e];
	var boxIsChecked = false;
	var foundIt = false
	
//iterate through temperature checkboxes
	
	$('.tempCol').each( function(index, object) {
		var day = parseInt($(this).siblings('.mvDay').text());

		boxIsChecked = $(this).children().is(':checked');
		
		if(boxIsChecked && day >= start &&  day <= stop )  {
			foundIt = true
			return;
		}	
	});	

	return foundIt;
}

function isWBCCheckedInVAEWindow(e) {  //e is the event index
	var start = vae.windowStartDay[e];
	var stop = vae.windowStopDay[e];
	var boxIsChecked = false;
	var foundIt = false;
	
//iterate through temperature checkboxes
	
	$('.wbcCol').each( function(index, object) {
		var day = parseInt($(this).siblings('.mvDay').text());

		boxIsChecked = $(this).children().is(':checked');
		
		if(boxIsChecked && day >= start &&  day <= stop )  {
			foundIt = true;
			return;
		}	
	});	

	return foundIt;
}

function areFourQADSInARow(e) {
	// find the value of the selected drug for each drug column		
	//return true;  //for now

	var selectID ;
	var selectedDrug;
	var allDrugs = new Array();
	var drugCol;
	var cbChecked = new Array();
	var QAD = new Array();
	//var cbIndex;
	var lastCBChecked;
	var day = 0;
	
	var retVal  = {};
	retVal.msg = '<p>An explanation of how to count QADs for the VAE on ' + getMVDate(vae.eventDays[e]) + ' follows:</p>';
	retVal.foundIVAC = false;
	retVal.drugChosen = true;
	retVal.duplicateDrug = false;
	
	//this array tracks all the QAD days across all drugs and is used to determine IVAC
	var QADCumulative = new Array();
	var iCum;

	
	for(var j=0; j<= drugColVis.length - 1; j++) {
		if(drugColVis[j]) {
			drugCol = ".drugCol" + j;
			selectID = "#selectDrug" + j + "  option:selected";
			selectedDrug = wordToUpper($(selectID).text());
			//first check to see if there was a drug selected in a column
			if ($('#selectDrug' + j +' option:selected').val() == '0') {
				retVal.drugChosen = (retVal.drugChosen && false);
			}
			
			//now see if there are any duplicate rows (the same drug chose in more than one row
			if(myIndexOf(allDrugs, selectedDrug) == -1) {
				allDrugs.push(selectedDrug);
				//alert(allDrugs.toString() + "val = " + selectedDrug);
			}
			else retVal.duplicateDrug = true;
		}
	}
	if(retVal.duplicateDrug || !retVal.drugChosen) return retVal;


	
	
		

	// iterate through all the possible drug columns but looking at on those that are visible
	for( i=0; i<= drugColVis.length - 1; i++) {
		//alert(i);
		

		//myAlert("In calcIVAC  i = " + i + "drugColVis = " + drugColVis[i]);

			if(drugColVis[i]) {
			
				drugCol = ".drugCol" + i;
				selectID = "#selectDrug" + i + "  option:selected";
				selectedDrug = wordToUpper($(selectID).text());

				//restart lastCBChecked
				lastCBChecked = -1;
		

				//now find all the checkboxes clicked under each drug
				//iterate over all the boxes in this column indexed by "index"

				$(drugCol).each( function(index, object) {
					day = parseInt($(this).siblings('.mvDay').text());

					QAD[index] = false;  //initially this is not a QAD
					
					//only look a tthe boxes around the VAE day
					//alert('vae.windowStartDay[e] = ' + vae.windowStartDay[e]);
					if(day >= (parseInt(vae.windowStartDay[e])-2) && day <= (parseInt(vae.windowStopDay[e]) + 4) ) {
						//for box index is this checked

						boxIsChecked = $(this).children().is(':checked');
															
						if(boxIsChecked) 
						{
							//myAlert("Box is checked at index = " + index + " The last box was checked at index = " + lastCBChecked );
							//day = parseInt($(this).siblings('.mvDay').text());
							//alert('day is ' + day.toString());
							retVal.msg += "<br>The drug administered box is checked on day " + getMVDate(day.toString()) + " for the drug " + selectedDrug + ".  ";
							
							
							//is this the first box checked?  i.e. lastCBChecked == -1
							if(lastCBChecked == -1  && day < vae.windowStartDay[e])
							{
								retVal.msg += "This drug was administered prior to the VAE Window and therefore is not considered a Qualifying Antimicrobial Day (QAD).  ";
								QAD[index] = false;
								lastCBChecked = index;
							}  			


							else if( day >= vae.windowStartDay[e] &&  day <= vae.windowStopDay[e]  && lastCBChecked == -1 )
							{
								
								retVal.msg += "This is a new drug start since this was not administered within the previous two days and falls within the VAE window.  ";
						
								QAD[index] = true;
								lastCBChecked = index;	
							}

							else if( day >= vae.windowStartDay[e] &&  day <= vae.windowStopDay[e] && lastCBChecked != -1 && (index - lastCBChecked) > 2 )
							{
								
								retVal.msg += "This is a new drug start even though it was administered prior to this date.  Because it falls with the VAE window and was not administered in the last two days, it is considered a QAD. ";
						
								QAD[index] = true;
								lastCBChecked = index;	
							}
							else if( lastCBChecked != -1 && (index - lastCBChecked) ==  1 && QAD[lastCBChecked] )
							{
								
								retVal.msg += "This is a QAD since a QAD occurred on the previous day. ";
						
								QAD[index] = true;
								lastCBChecked = index;	
							}
							else if( lastCBChecked != -1 && (index - lastCBChecked) ==  2 && QAD[lastCBChecked] )
							{
								
								retVal.msg += "This is a QAD since this drug was administered 2 days ago. The intervening day " + getMVDate((day-1).toString()) + " is also a QAD by the one day skip rule. ";
						
								QAD[index] = true;
								QAD[index-1] = true;
								lastCBChecked = index;	
							}
							else
							{
							
								retVal.msg += "This is not a QAD since it is neither a new drug start nor did a QAD occur in the preceeding two days. ";
						
								QAD[index] = false;
								lastCBChecked = index;	
							}
						}
					}
					
				});
				

				//if(needUserInput) return false;  //abort further processing until more input can be ggotten

				//copy the results of this drug column into the cumulative array thus "ANDing the two arrays
				for(j = 0; j <= QAD.length; j++) 
				{
					if(QAD[j]) QADCumulative[j] = QAD[j];
				}

			
			}  // end if
			
		}  // end for loop



		//finished with all the drugs so display the QAD results in the QAD column and figure out if there is 4 in a row!
		
		var prevIndex = 0;
		var inARow = 0;
		var maxInARow = 1;
		var foundOne = false; //flag for finding any QADs

		$('.QAD').each( function(index, object) {
			if(QADCumulative[index])
			{
				//set maxInARow to 1 since we have at least one!
				//maxInARow = 1;
				foundOne = true;

				$(this).html("yes");
				$(this).css("background-color", "Gray");
				
				if((index - prevIndex) == 1) maxInARow = Math.max(maxInARow, ++inARow);
				else inARow = 1;

				prevIndex = index;	
			}
			/********
			else
			{	
				$(this).html("&nbsp&nbsp&nbsp");
				$(this).css("background-color", "transparent");
			}
			*********/
		});

		if(!foundOne) maxInARow = 0;  //did not find any QADs
		

		if(maxInARow >= 4) 			retVal.msg += "<br>There are " + maxInARow + " Qualifying Antimicrobial Days (QADs) in a row. ";
		else if (maxInARow == 1) 	retVal.msg += "<br>There is only 1 Qualifying Antimicrobial Day (QAD) in a row. ";
		else if (maxInARow == 0)	retVal.msg += "<br>There are no Qualifying Antimicrobial Days (QADs).  ";
		else						retVal.msg += "<br>There are only " +  maxInARow  + " Qualifying Antimicrobial Days (QADs) in a row.  ";				

		if(maxInARow >= 4) retVal.foundIVAC = true;
		return retVal;

}

// helper function to clear the QAD column of prior results	
function clearQADCol()
{
$('.QAD').each( function(index, object) {

		$(this).html("&nbsp&nbsp&nbsp");
		$(this).css("background-color", "transparent");


	});
}



//This function finds the vacDay and stores it in a global var vacDay which is an index value starting at 1
function calcVAC()
{
	
	//first clear out any previous VAE determination
	clearVAE();
	resetVacDayLabel(true);
	$('#explain').show();  //show the explain button
	resetVAEObject();  //set results back to empty


	var input_vals = "";
	var inputError = false;
	var peep = [];
	var fio2 = [];
	var err = "";
	var peepException = "";
	direction = explanation = "";
	var peepLessThan5 = false;
	showPeepFooter(peepLessThan5);
	
	var err = "";
	$("input[name=PEEP]").each( function(index, object) {
	var peepVal = this.value.split('(');
	peep[index] = $.trim(peepVal[0]);
		if(peep[index] !== "") {  //ignore of no entry
			if( isNaN(peep[index])  || peep[index] <  0 || peep[index] > 40) {
				err += "<br>Input Error: The PEEP value = " + peep[index] + " on day " + getMVDate(index+1) + " must be a number between 0 and 40. <br>";	
				inputError = true;
			}
			else {
				peep[index] = parseFloat(peep[index]);
				if(peep[index] < 5 ) {
					this.value = '5 (' + peep[index] + ')*';  
					peep[index] = 5;
					peepLessThan5 = true;
				}
			}
		}
	});
	$("input[name=fio2]").each( function(index, object) {
		fio2[index] = $.trim(this.value);
		
		if(fio2[index] !== "") {
			if( isNaN(fio2[index]) || fio2[index] < 20 || fio2[index] > 100) {			
				err += "<br>The FiO2 value = " + fio2[index] + " on day " + getMVDate(index+1) + " must be between 20 and 100.  <br>";
				inputError = true;
			}
			else fio2[index] = parseFloat(fio2[index]);
		}
	});
	
	if(inputError) {
		myAlert(err);
		return  false;
	}
	

	//now look for periods of stability......
	var foundAVac;
	for (i=0; i < fio2.length-3; i++)
	{
		foundAVac = false; //this is a flag to catch the case where both FIO2 and PEEP vales give a VAC on the same day

		if(fio2[i+1] !== "" && fio2[i] !== "") {    //skip over null values
			if(fio2[i+1] - fio2[i] <= 0)  
			{	
				var maxVal = Math.max(fio2[i+1],fio2[i]);
				if ( (fio2[i+2] - maxVal  >= 20) && (fio2[i+3] - maxVal >= 20) ) {
					vae.eventDays.push(i+3);//Found a VAC
					vae.types.push('VAC');	
					vae.vacDeterminedBy.push(FIO2);
					foundAVac = true;
				}
							
			}

		}
 
		if(peep[i+1] !== "" && peep[i] !== "") {  //skip over null values 
			if(peep[i+1] - peep[i] <= 0 ) {
				var maxVal = Math.max(peep[i+1], peep[i]);
				
				if ( (peep[i+2] - maxVal >= 3)  && (peep[i+3] - maxVal >= 3) ) {
					//vacDays.push(i+2);  //Found a VAC	
					if(!foundAVac) {
						vae.eventDays.push(i+3);
						vae.types.push('VAC');
						vae.vacDeterminedBy.push(PEEP);
					}
					else vae.vacDeterminedBy[vae.vacDeterminedBy.length-1] = 'PEEP and FIO2';
					


				}
			}
		}
		
	//finally
	
	 showPeepFooter(peepLessThan5);

	}

	
	
	direction = '';
	explanation = '<h3>Explanation:</h3>';
	
	
	
	if(vae.eventDays.length) {	
	
		//alert(JSON.stringify(vae));
	
		var vacDaysCopy = [];
		var lastVAC;
		for(var j = 0; j < vae.eventDays.length; j++ ) {
			vacDaysCopy[j] = vae.eventDays[j];
		}
	
			for(var k = 0; k < vacDaysCopy.length; k++ ) {
				if(k == 0) {
					lastVAC = vae.eventDays[k];
					direction += "<p>A Ventilator-Associated Condition (VAC) based on " + vae.vacDeterminedBy[k] + " values occurred on " + getMVDate(vacDaysCopy[k]) + "</p>";
					explanation += "<p>The two days preceding " + getMVDate(vacDaysCopy[k]) + " are the baseline period of stability or improvement followed by a sustained period (&ge; 2 days) of worsening oxygenation. </p>";
				}
				else{
					if( vacDaysCopy[k] - lastVAC >= 14) {
						lastVAC = vacDaysCopy[k];
						direction += "<p>Another Ventilator-Associated Condition (VAC) based on " + vae.vacDeterminedBy[k] + " values occurred on " + getMVDate(vacDaysCopy[k]) + "<br>";
						explanation += "<p>The two days preceding " + getMVDate(vacDaysCopy[k]) + " are the baseline period of stability or improvement followed by a sustained period (&ge; 2 days) of worsening oxygenation. </p>";
						explanation += "<p>The VAC on " + getMVDate(vacDaysCopy[k]) + " is counted as a VAC since it occurred more than 14 days after the previous VAC.</p>";
					}
					else if(vacDaysCopy[k] - lastVAC != 0)  {
						var index = myIndexOf(vae.eventDays, vacDaysCopy[k].toString());
						if(index != -1) {
							vae.eventDays.splice(index, 1);
							vae.types.splice(index, 1);
							explanation += "<p>There would appear to be a VAC on " + getMVDate(vacDaysCopy[k]) + " based on " + vae.vacDeterminedBy[k] + " values, however there was a previous VAC which occurred on " + getMVDate(lastVAC)  + ". The timespan between the two is only " +(vacDaysCopy[k] - lastVAC).toString() + " days therefore " + getMVDate(vacDaysCopy[k]) + " is not counted as a VAC by the 14 day rule.";
						}
					}
					else { // vacDaysCopy[k] - lastVAC == 0
						explanation += "<p>There is a VAC on " + getMVDate(vacDaysCopy[k]) + " whereby both the PEEP and FiO2 values meet the criteria simultaneously.</p>"
					
					}
					
				}		
			}
		
	}	
	if(vae.eventDays.length) {
		//explanation = "<br>" + direction + "<br>" +  explanation;
		//alert(explanation);
		direction += "<br><span class='emphasis'>Click on the Go To IVAC button</span> to move to the next part of the protocol or click on the &#34Explain&#34 button to see how this determination was made. ";
		
		return true;
	}
	else {
		direction = "No VAE detected.  Click on the &quot;Explain&quot; button to see an explanation of the VAC definition.   "
		explanation =  "For a VAC to occur, there is a baseline period of stability or improvement of daily minimum PEEP or FiO<sub>2</sub> values on two consecutive days. This is followed by two consecutive days of worsening oxygenation where the \
						daily minimum PEEP values increase by 3 cmH<sub>2</sub>O or more or the daily minimum FiO<sub>2</sub> values increase by 20% or more, above the daily minimum value in the period of stability or improvement.  The date of the VAC is set to the first day of worsening after the baseline period.  <br> \
						For periods of stability where daily minimum PEEP values are &le; 5 cmH<sub>2</sub>O, the corresponding period of worsening oxygenation must have daily minimum PEEP values of 8 cmH<sub>2</sub>O or greater.<br>";

		return false;
	}

	
}

function showPeepFooter(flag) {

	if(flag) $('#peepLegend').show();
	else $('#peepLegend').hide();
}


function clearVAE()
{

	//hide the IVAC button(s)
	$('#IVAC').hide();
	$('.IVACCalc').hide();
	//$('#addDrugCol').hide();


	$(".inputRow").each(function(index){
		 
		$(this).children().each(function(index){
			$(this).css("background-color", "transparent");
			
		});

	});

	// unmark the VAC day

	resetVacDayLabel();


}



//converts a string of words so that the first letter of each word is capped and the rest lowercase
//got this off the internet.  
//only called to write out the selected drugs in the explanation which are all in upper case.

function wordToUpper(strSentence) {
     return strSentence.toLowerCase().replace(/\b[a-z]/g, convertToUpper);

       function convertToUpper() {         
		return arguments[0].toUpperCase();     
	} 
} 
function reshadeVAEWindow() {
	var color;
	$(".inputRow").each(function(index){
		color = $(this).children().first().css('background-color');
		$(this).children().each(function(index){
			$(this).css("background-color", color);
		});
	});
}


//This function calculates the VAC Window in the table and marks the VAC event 
function shadeVACWindows() {
	$('#buttonDivAtBottom').hide();
	if(vae.eventDays.length == 0) return false;

	
	var vacDayCount = vae.eventDays.length;
	
	for( var i = 0; i < vacDayCount; i++) {
		var setWindow = false;
		$(".inputRow").each(function(index){  //loop thru each row
			//shade only the vac window
			if(index > 1 && index >= vae.eventDays[i] - 3  && index <= vae.eventDays[i] + 1) { 
				if(!setWindow)  {
					vae.windowStartDay[i] = index+1;
					vae.windowStopDay[i] = vae.eventDays[i] + 2;
					setWindow = true;
				}
				
				$(this).children().each(function(index2){
					$(this).css("background-color", "NavajoWhite");
				});
			}
		});
	}
	
	resetVacDayLabel();
}
function deleteExtraneousRows() {
	$('#buttonDivAtBottom').hide();
	if(vae.eventDays.length == 0) return false;

	//only called when vacDay is set
	
	var rowsToDelete = [];
	
	//initialize rowstoDelete to true
	$(".inputRow").each(function(index){
		rowsToDelete[index] = true;
	});
		
	var daysPastEventDay = 5;
	var vacDayCount = vae.eventDays.length;	
	
	for( var i = 0; i < vacDayCount; i++) {
		$(".inputRow").each(function(index){
			//delete the rows not of interest to a VAC window or the surrounding days
			if(index >= vae.eventDays[i] - 5  && index <= vae.eventDays[i] + daysPastEventDay) {
				rowsToDelete[index] = false;
				if(index == (vae.eventDays[i] + daysPastEventDay) && vacDayCount > 1) {
					$(this).after('<tr> <th COLSPAN=9 BGCOLOR="#99CCFF">------------------</th> </tr>');
				}
			}
		});
	}
	
	$(".inputRow").each(function(index){
		if(rowsToDelete[index])  $(this).remove();
	});
	
	resetVacDayLabel();
}

function showDirection()
{
	//the div may be hidden by the reset button so show

	if (direction.length > 0)
	{
		//direction = "<b>" + direction + "</b>";
	
		$('#msgid').hide();

		$("#msgid").html(direction);

		$('#msgid').show();  // a few fancy effects!!!!!!!
	}
	direction.length = 0;  //erase direction
}


var formatDate = function(myDate) {
	
		var day = (parseInt(myDate.getDate())).toString();
		var mon = (parseInt(myDate.getMonth()) + 1).toString();
		var yr = myDate.getFullYear();
		return mon + '/' + day + '/' + yr;
	}
var myIndexOf = function(a, d) {
	if(!a) return -1;
	if(d) d= trim(d);
	for(var i = 0; i < a.length; i++) {
		if(a[i] == d) return i;
	}
	return -1;
}
	// remove multiple, leading or trailing spaces function 
	var trim = function(s) {  
		s = s.toString();
		s = s.replace(/(^\s*)|(\s*$)/gi,"");    
		s = s.replace(/[ ]{2,}/gi," ");     
		s = s.replace(/\n /,"\n"); 
		return s;
	}

function nextDay(d)
{
	var ONE_DAY_PLUS = 1000 * 60 * 60 * 25;  //25 because the last day of daylight saving time has 25 hours in a day
	var nd = new Date(d.getTime() + ONE_DAY_PLUS);
	//set nextDay time back to 12:00 for all the other days that only have 24 hours
	nd.setHours(0);
	nd.setMinutes(0);
	nd.setSeconds(0);
	nd.setMilliseconds(0);
	
	return nd;

}

function getMVDate(day) {
//given a MVDay what is the correstonding date

	var d = $('.mvDay').filter(function (index) {
		return $(this).text() == day.toString();
	});
	var mvDate = d.siblings('.mvDate').text();
	return mvDate;
}


 function myAlert(expl)
 {
	explanation = expl;
	$('#explain').trigger('click');
	
 }
 function updateMyAlert(expl)
 {
	
	//if( expl.length == 0) expl = "No Explanation found";
	
	if( $('#explainBox').is(':visible') ) {  
		//$('#explainBox').fadeOut();
		//$('#explainBox').fadeIn();
		$('#msg').html(expl);
	}
}
 
	function resetVAEObject() {
		vae.eventDays = [];
		vae.types=[];  
		vae.windowStartDay = [];
		vae.windowStopDay = [];
		vae.hasVAPBeenDetermined = [];
		vae.vacDeterminedBy = [];
	}

/********************** Start of PVAP functionality *******************************/
function calcPVAP() {
	
	var checked = false;
	var str = "";
	var i = 0;
	direction = 'No check boxes were checked. Therefore this event should be reported as an IVAC.  ';
	explanation += 'No check boxes were checked. Therefore this event should be reported as an IVAC.  ' + LINE;

	
	
	var r = getPVAPCandidate();
	if(!r.foundOne) {
		$('#PVAP').attr('disabled', 'disabled');  //should be done so disable any more PVAP pages from showing
		return false;
	}
	
	var thisVapCandidate = r.index;
	var ivacDate =  getMVDate(vae.eventDays[thisVapCandidate]);
	
	updateMyAlert(explanation);

	var rowsChecked = "";
	
	
	// note Criterion is singular  Criteria is plural
	$('.pVap').each( function(index, object) {
		//loop through each of the PVAP check boxes 
		if( $(this).children().is(':checked') )  {
			checked = true;
			
				if(index == 0) rowsChecked = "Criterion 1 is checked.  ";
				if (index == 1) {
					if(rowsChecked) rowsChecked = rowsChecked.replace("Criterion 1 is", "Criteria 1 and 2 are");
					else rowsChecked = "Criterion 2 is checked. ";
				}

				if (index == 2) {
					if(rowsChecked) {
						
						rowsChecked = rowsChecked.replace("Criterion 1 is", "Criteria 1 and 3 are");
						rowsChecked = rowsChecked.replace("1 and 2 are", "1, 2 and 3 are");
						rowsChecked = rowsChecked.replace("Criterion 2 is", "Criteria 2 and 3 are");
					}
					else rowsChecked = "Criterion 3 is checked. "
				}
			
			
		}
	});		
		//alert("row " + row + " was checked");
	if(checked) {		
		direction = "<p>The event on " + ivacDate + " conforms to a Possible Ventilator-Associated Pneumonia (PVAP) definition.  For a discussion of why, click on the Explain button. </p>";
		explanation = "<p>" + rowsChecked + " Clicking &quot;Yes&quot; to any of the three criteria is sufficient to meet the definition of a Possible Ventilator-Associated Pneumonia (PVAP) for the event on " + ivacDate + ". </p>";
		//$('#vapDiv').hide();
		vae.types[thisVapCandidate] = 'PVAP';
		
		resetVacDayLabel();
	}
	else {
			explanation += "<p>For the event on <span class = 'emphasis'>" + ivacDate + "</span>, no Boxes are checked.  Therefore this case should be reported as an IVAC. </p>";
			direction += "<p>The event on " + ivacDate + "conforms to the IVAC definition only.  </p>";
		}
	

	//regardless the PVAP has been tested. therefore
	vae.hasVAPBeenDetermined[thisVapCandidate] = true;
	
	
	$('#table1').hide();

	
	//now are there any more IVACs for this patient?
	r = getPVAPCandidate();
	if(r.foundOne)  {
		//there are more so show instructions and a next button
			direction += "<p>Click on the &quot;Next&quot;button below to go to the next IVAC candidate";
			showDirection();
			$("#nextIVAC").show();
			$('#calcPVAP').hide();
			$('#cancelPVAP').hide();
	}
	else {   //there are no more candidates
		$('#calcPVAP').hide();
		$("#nextIVAC").hide();
		$('#cancelPVAP').show();
	}
	
	
	$('#vapTitle').html(direction);
	updateMyAlert(explanation);
	showDirection();
	return true;
	

}



function showPVAPPage(vapCandidateIndex) {

	
	var r = getPVAPCandidate();
	//are there any IVACs that have not been checked out for PVAP
	if(!r.foundOne) return false;
	
	//make sure the checkboxes are unchecked
	
	$(".cb2").attr('checked', false); // Unchecks it
	
	 vapCandidateIndex = r.index;
	
	var instructions = "";
	

	//info for this VAE
	var ivacDate =  getMVDate(vae.eventDays[vapCandidateIndex]);
	var windowStartDate =  getMVDate(vae.windowStartDay[vapCandidateIndex]);
	var windowStopDate = getMVDate(vae.windowStopDay[vapCandidateIndex]);
			
	instructions += "<center><h3>PVAP Determination</h3></center>For the IVAC on <span class='emphasis'>" + ivacDate + "</span>, did the patient have documentation of any of the following findings during the VAE Window: <span class='emphasis'>" + windowStartDate + " to " + windowStopDate + "</span>.  ";


	var bigDivTop =  	$('#bigDiv').offset().top;
	var bigDivLeft = 	$('#bigDiv').offset().left;
	var bigDivWidth = 	$('#bigDiv').width();
	var explainBoxWidth = 	400;
	var bigDivHeight = 	Math.min($('#bigDiv').height(), $(window).height()) ;
	var explainBoxHeight = 	400;
		
	var left = Math.max( bigDivLeft +(bigDivWidth - explainBoxWidth)/2, 20);
	var top  = Math.max( bigDivTop +(bigDivHeight - explainBoxHeight)/2, 20);
		
	$('#vapDiv').css("top", top );
	$('#vapDiv').css("left", left );
	$('#vapDiv').draggable();
		
	
	$('#vapDiv').show();
	$('#vapTitle').html(instructions);
	$("#nextIVAC").hide();
	$('#table1').show();

	$('.probVapAbs > input ').attr("checked", false); 
	$('.possVap > input ').attr("checked", false); 

	//configure the buttons...	
	$('#calcPVAP').show();
	//$('#cancelPVAP').show();
	$('.IVACCalc').hide();

	return true;


}



function getPVAPCandidate() {
	var ret = new retObj(0, false);  //a global object of event days and types	

	for(var i = 0; i < vae.types.length; i++) {
		if( vae.types[i] == "IVAC" && !vae.hasVAPBeenDetermined[i]) {
			ret.index = i;
			ret.foundOne = true;
			return ret;
		}
	}
	return ret;
}
function initializeVaeVapFlags() {
	for(var i = 0; i < vae.types.length; i++) {
		vae.hasVAPBeenDetermined[i] = false;
	}
}

function countVAPCandidates() {
	var count = 0;
	for(var i = 0; i < vae.types.length; i++) {
		if( vae.types[i] == "IVAC" && !vae.hasVAPBeenDetermined[i]) count++;
	}
	return count;
}
	
function setVAPDirection() {
	var c = countVAPCandidates();
	if(c <= 1) 	direction = 'Now that an IVAC determination has been made, click the checkbox if the patient experienced any of the listed conditions within the VAE Window (shaded area). Then click on the &quot;Calculate PVAP&quot; button. ';
	else 		direction = 'This patient has ' + c + ' IVACs. A series of boxes will open up for each IVAC.  Click the checkbox if the patient experienced any of the listed conditions within the VAE Window (shaded area) for that IVAC. The table heading will indicate to which IVAC the questions refer. Then click on the &quot;Calculate PVAP&quot; button';
	showDirection();

}	

/********************** End of PVAP functionality *******************************/
	
});	// end of ready function	
 
 

