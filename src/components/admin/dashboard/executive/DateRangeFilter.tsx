import { useState } from "react";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
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
    const today = new Date();

    switch (preset) {
      case "all":
        onDateRangeChange({ from: undefined, to: undefined });
        break;
      case "today":
        onDateRangeChange({ from: today, to: today });
        break;
      case "yesterday":
        const yesterday = subDays(today, 1);
        onDateRangeChange({ from: yesterday, to: yesterday });
        break;
      case "last7days":
        onDateRangeChange({ from: subDays(today, 6), to: today });
        break;
      case "last30days":
        onDateRangeChange({ from: subDays(today, 29), to: today });
        break;
      case "thisWeek":
        onDateRangeChange({
          from: startOfWeek(today, { weekStartsOn: 1 }),
          to: endOfWeek(today, { weekStartsOn: 1 }),
        });
        break;
      case "thisMonth":
        onDateRangeChange({
          from: startOfMonth(today),
          to: endOfMonth(today),
        });
        break;
      case "lastMonth":
        const lastMonth = subMonths(today, 1);
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
    onDateRangeChange({
      from: range?.from,
      to: range?.to,
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
