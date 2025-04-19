#!/bin/bash
now=$(date)
status=$(supervisorctl status $1 | grep -oE '(RUNNING|STOPPED|STARTING|STOPPING|EXITED|FATAL)')
echo "OmniFlix Service status : "$status

if [[ ${status} == 'RUNNING' ]]; then
    echo "---"
    echo 'Omniflix Stream Engine streaming...'
    PID=$(supervisorctl status $1 | awk '{if ($2 == "RUNNING") print $4; else print ""}' | tr -d ',')
    echo "OmniflixStream PID - $PID"

    SPID=$( pgrep -P $PID )
    SSPID=$( pgrep -P $SPID )
    SSSPID=$( pgrep -P $SSPID )

    echo "PY PID : " $SPID "/ SH PID : " $SSPID " / FF PID : " $SSSPID

    timeinsecs=$(ps -o etimes= -p ${PID}) #in seconds
    timeinsecs=$((timeinsecs - 4)) #remove time took to start streaming from start time of ffmpeg

    ss=$(date -d@${timeinsecs} -u +%H:%M:%S)

    TIME1=$ss
    TIME2=03:00:00
    TOTAL=10800 #3 hours in seconds

    echo "Elapsed : " $timeinsecs "/" ${TIME1}
    #echo "Elapsed : " ${TIME1}

    # Convert the times to seconds from the Epoch
    #SEC1=`date +%s -d ${TIME1}`
    #SEC2=`date +%s -d ${TIME2}`
    # Use expr to do the math, let's say TIME1 was the start and TIME2 was the finish
    #DIFFSEC=`expr ${SEC2} - ${TIME1}`

    LIMIT=60

    #calculate diff in seconds uing base time in seconds
    DIFFSEC=`expr ${TOTAL} - ${timeinsecs}`

    REM=$(date -d@$DIFFSEC -u +%H:%M:%S)
    echo "Remaining : " ${DIFFSEC} "/" ${REM}

    echo "Total : " $TOTAL "/" ${TIME2}
else
    echo 'Not running'
fi

echo "Done"
echo "--------------------------------------------------"

