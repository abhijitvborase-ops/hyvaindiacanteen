import '@angular/compiler';
// Import application styles so the dev server/bundler serves them with the correct MIME type.
import './src/style.css';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { AppComponent } from './src/app.component';
import { importProvidersFrom } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms'; 
import { provideRouter, withHashLocation, withInMemoryScrolling } from '@angular/router';
import { routes } from './src/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    importProvidersFrom(ReactiveFormsModule),
    provideRouter(routes, withHashLocation(), withInMemoryScrolling({anchorScrolling: 'enabled'}))
  ],
}).catch((err) => console.error(err));

// AI Studio always uses an `index.tsx` file for all project types.