# A grown root partition is compatible with the same image layout. Keep its
# existing end sector; all image partition starts and the boot size must match.
swrt_partition_difference() {
    awk '
        FNR == NR { start[$1]=$2; size[$1]=$3; next }
        {
            count++
            if ($1 != 1 && $1 != 2) bad=1
            if ($2 !~ /^[0-9]+$/ || $3 !~ /^[0-9]+$/ || $3 <= 0) bad=1
            if (!($1 in start) || start[$1] != $2) bad=1
            if ($1 == 2) { root++; if (size[$1] < $3) bad=1 }
            else { boot++; if (size[$1] != $3) bad=1 }
        }
        END {
            if (bad || count != 2 || root != 1 || boot != 1)
                print "Incompatible partition layout"
        }
    ' "$1" "$2"
}
