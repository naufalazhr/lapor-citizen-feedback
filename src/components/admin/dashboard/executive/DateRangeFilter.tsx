import { useState } from "react";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DateRangeFilterProps {
  dateRange: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
}

type PresetKey = "all" | "today" | "yesterday" | "last7days" | "last30days" | "thisWeek" | "thisMonth" | "lastMonth" | "custom";

const presets: { key: PresetKey; label: string }[] = [
  { key: "all", label: "Semua Data" },
  { key: "today", label: "Hari Ini" },
  { key: "yesterday", label: "Kemarin" },
  { key: "last7days", label: "7 Hari Terakhir" },
  { key: "last30days", label: "30 Hari Terakhir" },
  { key: "thisWeek", label: "Minggu Ini" },
  { key: "thisMonth", label: "Bulan Ini" },
  { key: "lastMonth", label: "Bulan Lalu" },
  { key: "custom", label: "Pilih Tanggal..." },
];

export function DateRangeFilter({ dateRange, onDateRangeChange }: DateRangeFilterProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("all");

  const handlePresetChange = (preset: PresetKey) => {
    setSelectedPreset(preset);
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    switch (preset) {
      case "all":
        onDateRangeChange({ from: undefined, to: undefined });
        break;
      case "today":
        onDateRangeChange({ from: todayStart, to: todayEnd });
        break;
      case "yesterday":
        const yesterdayStart = startOfDay(subDays(now, 1));
        const yesterdayEnd = endOfDay(subDays(now, 1));
        onDateRangeChange({ from: yesterdayStart, to: yesterdayEnd });
        break;
      case "last7days":
        // Include today and 6 days before = 7 days total
        onDateRangeChange({ from: startOfDay(subDays(now, 6)), to: todayEnd });
        break;
      case "last30days":
        // Include today and 29 days before = 30 days total
        onDateRangeChange({ from: startOfDay(subDays(now, 29)), to: todayEnd });
        break;
      case "thisWeek":
        onDateRangeChange({
          from: startOfWeek(now, { weekStartsOn: 1 }),
          to: endOfWeek(now, { weekStartsOn: 1 }),
        });
        break;
      case "thisMonth":
        onDateRangeChange({
          from: startOfMonth(now),
          to: endOfMonth(now),
        });
        break;
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        onDateRangeChange({
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth),
        });
        break;
      case "custom":
        setIsCalendarOpen(true);
        break;
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    // Normalize calendar selections to full day boundaries
    onDateRangeChange({
      from: range?.from ? startOfDay(range.from) : undefined,
      to: range?.to ? endOfDay(range.to) : undefined,
    });
    if (range?.from && range?.to) {
      setIsCalendarOpen(false);
    }
  };

  const handleClear = () => {
    setSelectedPreset("all");
    onDateRangeChange({ from: undefined, to: undefined });
  };

  const formatDateRange = () => {
    if (!dateRange.from && !dateRange.to) {
      return "Semua Data";
    }

    if (dateRange.from && dateRange.to) {
      if (dateRange.from.toDateString() === dateRange.to.toDateString()) {
        return format(dateRange.from, "d MMMM yyyy", { locale: idLocale });
      }
      return `${format(dateRange.from, "d MMM", { locale: idLocale })} - ${format(dateRange.to, "d MMM yyyy", { locale: idLocale })}`;
    }

    if (dateRange.from) {
      return `Dari ${format(dateRange.from, "d MMM yyyy", { locale: idLocale })}`;
    }

    return "Pilih tanggal";
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedPreset} onValueChange={(value) => handlePresetChange(value as PresetKey)}>
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder="Pilih periode" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.key} value={preset.key}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedPreset === "custom" && (
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-9 justify-start text-left font-normal",
                !dateRange.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatDateRange()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={{
                from: dateRange.from,
                to: dateRange.to,
              }}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              locale={idLocale}
            />
          </PopoverContent>
        </Popover>
      )}

      {(dateRange.from || dateRange.to) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2"
          onClick={handleClear}
          title="Hapus filter"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      {(dateRange.from || dateRange.to) && selectedPreset !== "custom" && (
        <span className="text-sm text-muted-foreground hidden md:inline">
          {formatDateRange()}
        </span>
      )}
    </div>
  );
}
