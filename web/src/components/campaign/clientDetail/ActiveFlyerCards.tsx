import React from "react";
import type { PrintoutData } from "../../../models/printout";

type Printout = PrintoutData & { id: string };

interface ActiveFlyerProps {
  printouts: Printout[];
  activePrintoutId: string;
}

/** Admin notices on a draft campaign: which flyer walkers will deliver, or what is still missing. */
export const DraftFlyerNotices: React.FC<ActiveFlyerProps> = ({ printouts, activePrintoutId }) => (
  <>
    {/* Active Flyer Display - show what walkers will see */}
    {activePrintoutId && printouts.length > 0 && (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-900/20">
        <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-3">Active Flyer</h3>
        {(() => {
          const activePrintout = printouts.find((p) => p.id === activePrintoutId);
          if (!activePrintout) return null;
          return (
            <div className="flex items-center gap-3">
              {activePrintout.fileUrl && (
                <img src={activePrintout.fileUrl} alt={activePrintout.name} className="h-16 w-16 rounded object-cover flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-emerald-900 dark:text-emerald-100">{activePrintout.name}</p>
                <p className="text-sm text-emerald-800 dark:text-emerald-200">This is what walkers will deliver</p>
                {activePrintout.flyerId && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">From your flyer library</p>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    )}

    {/* Empty state: no printouts yet */}
    {printouts.length === 0 && (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/60 rounded-lg p-4">
        <div className="flex gap-3">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0zm3 0a1 1 0 11-2 0 1 1 0 012 0zm3 0a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">No flyer selected</p>
            <p className="text-sm text-blue-800 dark:text-blue-200">Walkers won't see anything to deliver. Upload a flyer or select one from your library to get started.</p>
          </div>
        </div>
      </div>
    )}

    {/* Warning: printouts exist but no active flyer */}
    {printouts.length > 0 && !activePrintoutId && (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/60 rounded-lg p-4">
        <div className="flex gap-3">
          <svg className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">No active flyer set</p>
            <p className="text-sm text-amber-800 dark:text-amber-200">Please select one of your flyers above before publishing. You won't be able to publish without an active flyer.</p>
          </div>
        </div>
      </div>
    )}
  </>
);

/** The flyer walkers deliver, shown to everyone once the campaign has left draft. */
export const ActiveFlyerCard: React.FC<ActiveFlyerProps> = ({ printouts, activePrintoutId }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Flyer for This Campaign</h3>
    {(() => {
      const activePrintout = printouts.find((p) => p.id === activePrintoutId);
      if (!activePrintout) return null;
      return (
        <div className="flex items-center gap-3">
          {activePrintout.fileUrl && (
            <img src={activePrintout.fileUrl} alt={activePrintout.name} className="h-16 w-16 rounded object-cover flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-gray-100">{activePrintout.name}</p>
            {activePrintout.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{activePrintout.description}</p>
            )}
          </div>
        </div>
      );
    })()}
  </div>
);
