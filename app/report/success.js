require(["../store/egv_records", "../bloodsugar", "/app/config.js!"], function(data, convertBg, config) {
	var low = parseInt(config.targetrange.low),
		high = parseInt(config.targetrange.high);
	var config = {
		low: convertBg(low),
		high: convertBg(high)
	};
	var now = Date.now();
	var period = (7).days();
	var firstDataPoint = data.reduce(function(min, record) {
		return Math.min(min, record.displayTime);
	}, Number.MAX_VALUE);
	if (firstDataPoint < 1390000000000) firstDataPoint = 1390000000000;
	var quarters = Math.floor((Date.now() - firstDataPoint) / period);

	var grid = $("#grid");
	var table = $("<table/>");

	if (quarters == 0) {
		// insufficent data
		grid.append("<p>There is not yet sufficent data to run this report. Try again in a couple days.</p>");
		return;
	}

	var dim = function(n) {
		var a = [];
		for (i = 0; i < n; i++) {
			a[i]=0;
		}
		return a;
	}
	var sum = function(a) {
		return a.reduce(function(sum,v) {
			return sum+v;
		}, 0);
	}
	var averages = {
		percentLow: 0,
		percentInRange: 0,
		percentHigh: 0,
		standardDeviation: 0,
		lowerQuartile: 0,
		upperQuartile: 0,
		average: 0
	};
	try {
		quarters = dim(quarters).map(function(blank, n) {
			var starting = new Date(now - (n+1) * period),
				ending = new Date(now - n * period);
			return {
				starting: starting,
				ending: ending,
				records: data.filter(function(record) {
					return record.displayTime > starting &&
					record.displayTime <= ending &&
					"bgValue" in record &&
					 /\d+/.test(record.bgValue.toString());
				})
			};
		}).filter(function(quarter) {
			return quarter.records.length > 0;
		}).map(function(quarter, ix, all) {
			var bgValues = quarter.records.map(function(record) {
				return parseInt(record.bgValue,10);
			});
			quarter.standardDeviation = ss.standard_deviation(bgValues);
			quarter.average = bgValues.length > 0? (sum(bgValues) / bgValues.length): "N/A";
			quarter.lowerQuartile = ss.quantile(bgValues, 0.25); 
			quarter.upperQuartile = ss.quantile(bgValues, 0.75);
			quarter.numberLow = bgValues.filter(function(bg) {
				return bg < low;
			}).length;
			quarter.numberHigh = bgValues.filter(function(bg) {
				return bg >= high;
			}).length;
			quarter.numberInRange = bgValues.length - (quarter.numberHigh + quarter.numberLow);

			quarter.percentLow = (quarter.numberLow / bgValues.length) * 100;
			quarter.percentInRange = (quarter.numberInRange / bgValues.length) * 100;
			quarter.percentHigh = (quarter.numberHigh / bgValues.length) * 100;

			averages.percentLow += quarter.percentLow / all.length;
			averages.percentInRange += quarter.percentInRange / all.length;
			averages.percentHigh += quarter.percentHigh / all.length;
			averages.lowerQuartile += quarter.lowerQuartile / all.length;
			averages.upperQuartile += quarter.upperQuartile / all.length;
			averages.average += quarter.average / all.length;
			averages.standardDeviation += quarter.standardDeviation / all.length;
			return quarter;
		});
	} catch (e) {
		console.log(e);
	}

	var lowComparison = function(quarter, averages, field, invert) {
		if (quarter[field] < averages[field] * 0.8) {
			return (invert? "bad": "good");
		} else if (quarter[field] > averages[field] * 1.2) {
			return (invert? "good": "bad");
		} else {
			return "";
		}
	}

	var lowQuartileEvaluation = function(quarter, averages) {
		if (quarter.lowerQuartile < low) {
			return "bad";
		} else {
			return lowComparison(quarter, averages, "lowerQuartile");
		}
	}

	var upperQuartileEvaluation = function(quarter, averages) {
		if (quarter.upperQuartile > high) {
			return "bad";
		} else {
			return lowComparison(quarter, averages, "upperQuartile");
		}
	}

	var averageEvaluation = function(quarter, averages) {
		if (quarter.average > high) {
			return "bad";
		} else if (quarter.average < low) {
			return "bad";
		} else {
			return lowComparison(quarter, averages, "average", true);
		}
	}

	table.append("<thead><tr><th>Period</th><th>Lows</th><th>In Range</th><th>Highs</th><th>Standard<br/>Deviation</th><th>Low<br/>Quartile</th><th>Average</th><th>Upper<br/>Quartile</th></tr></thead>");
	table.append("<tbody>" + quarters.filter(function(quarter) {
		return quarter.records.length > 0;
	}).map(function(quarter) {
		try {
			var INVERT = true;
			return "<tr>" + [
				quarter.starting.format("M d Y") + " - " + quarter.ending.format("M d Y"),
				{
					klass: lowComparison(quarter, averages, "percentLow"),
					text: Math.round(quarter.percentLow) + "%"
				},
				{
					klass: lowComparison(quarter, averages, "percentInRange", INVERT),
					text: Math.round(quarter.percentInRange) + "%"
				},
				{
					klass: lowComparison(quarter, averages, "percentHigh"),
					text: Math.round(quarter.percentHigh) + "%"
				},
				{
					klass: lowComparison(quarter, averages, "standardDeviation"),
					text: (quarter.standardDeviation > 10? Math.round(quarter.standardDeviation): quarter.standardDeviation.toFixed(1))
				},
				{
					klass: lowQuartileEvaluation(quarter, averages),
					text: convertBg(quarter.lowerQuartile)
				},
				{
					klass: lowComparison(quarter, averages, "average"),
					text: convertBg(quarter.average)
				},
				{
					klass: upperQuartileEvaluation(quarter, averages),
					text: convertBg(quarter.upperQuartile)
				}
			].map(function(v) {
				if (typeof v == "object") {
					return "<td class=\"" + v.klass + "\">" + v.text + "</td>";
				} else {
					return "<td>" + v + "</td>";
				}
			}).join("") + "</tr>";
		}
		catch (e) {
			console.log(e);
		}
	}).join("") + "</tbody>");
	table.appendTo(grid);
	$(".print").click(function(e) {
		e.preventDefault();
		window.print();
	});
});